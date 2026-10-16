# Security self-assessment

The core design principle: **the language model can propose, but only deterministic code and the user can move money.**

## 1. Permission tiers

Each agent tool has a fixed tier, and each tier carries a different level of authority.

| Tier | Name | Tools | Default behaviour |
|---|---|---|---|
| L0 | Read | `get_overview`, `list_transactions`, `get_fx_quote`, `compare_transfer_routes`, `analyze_budget`, `get_country_guide`, `list_payees`, `list_pending_actions`, `report_security_concern` | Runs automatically and is logged |
| L1 | Plan | `set_budget` | Runs automatically and is logged; no money moves |
| L2 | Transact | `propose_currency_conversion`, `propose_transfer` | Creates a **pending action** that the user must approve |
| L3 | Trust | `propose_add_payee` | Always needs approval, after fraud and sanctions screening |
| — | User-only | Approve/reject, settings, limits, agent mode | No tool exists for these; only UI endpoints reach them |

### Agent modes (chosen by the user)
- **Advisor:** L0 only. All L1, L2 and L3 calls are blocked.
- **Co-pilot (default):** the agent can propose anything, and the user approves every L2 and L3 action.
- **Autopilot:** conversions between the user's own accounts run automatically only when they are under the user's autopilot limit (default USD 50, maximum USD 500) **and** rated low risk. Transfers to other people and new payees always need approval.

## 2. Controls

| Threat | Control | Where |
|---|---|---|
| The model sends money without consent | Money-moving tools only create pending actions. Execution is reachable only from `POST /api/actions`, which the UI calls when the user presses Approve | `tools.ts`, `actions.ts` |
| A proposal is approved after conditions change | Policy is re-evaluated at approval time: balances, limits, mode and payee | `actions.ts` `decide()` |
| Stale approvals | Pending actions expire after 15 minutes | `PENDING_TTL_MIN` |
| Double execution | A pending action is removed before it runs, so approving it again fails | `actions.ts` |
| Limits exceeded | Per-transaction, daily and per-route limits; velocity limit of 3 transfers per 10 minutes | `policy.ts` |
| Payment to the wrong recipient | Payments only go to saved payees. New payees are L3, need approval, and are screened | `policy.ts` |
| Invoice and business-email fraud | Look-alike name of a verified payee with a different account is rated high risk, with a warning to verify by phone | `policy.ts` `nameSimilarity` |
| Sanctions | Names are screened against a mock watchlist and blocked on a match | `policy.ts` `WATCHLIST` |
| Prompt injection via uploaded documents | Documents are wrapped and labelled as untrusted data. The system prompt forbids following embedded instructions, and the agent reports them with `report_security_concern`. Even if the model were fooled, it **has no tool** to approve, raise limits or skip confirmation | `agent.ts`, architecture |
| Malformed or hallucinated tool input | Every tool input is validated with a strict Zod schema; invalid input becomes an error result and nothing runs | `tools.ts` |
| Client tampering with balances, settings or approvals | The ledger state is HMAC-SHA256 signed by the server. Any change breaks the signature and is rejected | `token.ts` |
| Data exposure to the model | The agent sees account numbers masked to the last four digits | `list_payees` |
| Abuse and cost | Per-IP rate limits and request size limits (messages up to 4,000 characters, files up to about 3 MB) | `http.ts`, API routes |
| Wrong or fake visa links | Checklist links are a curated list of official government sites, checked on 2026-10-14. The agent is told never to invent URLs, and to link only to university or government domains it finds through web search. The UI shows each link's real domain next to it | `guide.ts`, `Markdown.tsx` |
| Personal data in web searches | The agent is told never to put the student's name, ID or other personal data in search queries | `agent.ts` |
| Handling identity documents | The app never fills in, stores or submits immigration documents. It tracks only which steps are done (true/false) | `guide.ts` |
| Misleading advice | The system prompt states that the agent gives general information, not regulated advice, and points users to official sources for visas, tax and scholarships | `agent.ts` |
| Model refusal | Server-side refusal fallback (`fallbacks: "default"`) | `agent.ts` |
| Browser hardening | `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a restrictive permissions policy | `next.config.ts` |

## 3. Audit trail

Every tool call, proposal, approval, rejection, block, expiry, security flag and settings change is written to the audit log with its timestamp, actor (agent, user or system), tier and decision. The user can export the log as JSON from the **Activity** tab, and this export serves as the execution evidence for the submission.

## 4. Known risks and limitations

| # | Risk | Impact | Mitigation and next step |
|---|---|---|---|
| 1 | **State replay:** a client can resend an older signed token and restore an earlier sandbox state | Contained to the user's own sandbox, so no cross-user impact | Production would keep state in a database with version numbers; the token is a stateless-demo design choice |
| 2 | The rate limiter is in memory per server instance | Weak throttling on serverless hosts | Use a shared store such as Redis |
| 3 | No user authentication; a session is whoever holds the token | Fine for a demo, not for production | Add OAuth or passkeys, and bind tokens to the user and device |
| 4 | Prompt injection can still change the agent's **words**, for example a misleading summary | The user could be misinformed | Approval cards show policy-generated summaries and risk reasons that don't come from the model; users approve based on the card |
| 5 | The fraud heuristics (name similarity, watchlist) are simple | False negatives and false positives | Use proper entity resolution, real sanctions lists and beneficiary-name confirmation |
| 6 | FX rates, fees and routes are simulated | Estimates are not real quotes | Integrate licensed FX and payment APIs |
| 7 | The country guides are static and may go out of date | Outdated guidance | Add sources and review dates, and link to official pages |
| 8 | Uploaded documents are sent to the LLM provider | Privacy | Allow redaction before upload, set data-retention terms, and use regional hosting where required |
| 9 | Risk reasons and route notes are in English only | Readability for non-English users | The agent explains them in the user's language; translate them later |
| 10 | The demo signing secret is used when `LEDGER_SIGNING_SECRET` is unset in development | Tokens are forgeable in dev | Production refuses to start without the secret |
| 11 | Visa rules change, and the curated steps can go out of date | Students could act on outdated steps | Show a "last checked" date, review links every term, and keep telling students that the official page has the final say |
| 12 | Web search results can include unofficial look-alike sites | A student could follow a phishing page | The prompt limits links to official domains and the UI shows the domain; a future step is a domain allowlist for each university |
| 13 | Places, ratings and reviews are generated demo data | Could be mistaken for real reviews | Labelled "Demo data" in the UI and in every agent reply; replace with a licensed places API before real use. Google Maps is also blocked in mainland China, so add Amap/Dianping links for China later |
