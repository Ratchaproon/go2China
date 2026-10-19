# Technical documentation

## 1. System architecture

```
 Browser (Next.js React app, PWA)
 ├─ Onboarding: language, home country → destination, university
 ├─ Chat with rich cards (FX, routes, budget, approval)
 ├─ Wallet / Activity (audit log export) / Settings (mode & limits)
 └─ Holds the signed ledger token (reads it to render; cannot modify it)
        │  HTTPS (JSON)
        ▼
 Next.js API routes (stateless)
 ├─ POST /api/session   create sandbox ledger for a profile
 ├─ POST /api/chat      run one agent turn ──► Claude (Messages API, tool use)
 ├─ POST /api/actions   user approves / rejects a pending action
 └─ POST /api/settings  user changes language, agent mode, limits
        │
        ▼
 Core library (src/lib)
 ├─ agent.ts    agent loop, system prompt, untrusted-document wrapping
 ├─ tools.ts    13 tools, Zod validation, permission tier per tool
 ├─ policy.ts   deterministic policy engine: limits, AML, fraud, modes
 ├─ actions.ts  human-in-the-loop execution (re-checks policy)
 ├─ ledger.ts   sandbox bank: accounts, txns, payees, budgets, audit
 ├─ fx.ts       sandbox FX (deterministic daily movement, 30-day history)
 ├─ routes.ts   simulated payment rails and pricing
 └─ token.ts    HMAC-SHA256 signed state
```

**Why stateless:** the whole sandbox ledger travels with the client as a signed token (`base64url(JSON).HMAC`). This means the demo needs no database, can be deployed with one command, and keeps every user's sandbox isolated. The signature stops the client from forging balances, approvals or settings. See SECURITY.md for the replay limitation.

## 2. Agent design

- **Model:** Claude (`claude-opus-5-5` by default; override with `ANTHROPIC_MODEL`), called through the official Anthropic TypeScript SDK with a manual tool-use loop of up to 10 steps per turn.
- **Effort:** `medium`, which balances latency in a chat interface with reliable multi-step tool use.
- **Prompt caching:** the tool definitions and the stable system prompt are cached; the per-user context (countries, mode, date, reply language) goes in a second, uncached system block.
- **Refusal fallback:** server-side `fallbacks: "default"`.
- **Multilingual:** the agent replies in the student's selected language, or in whatever language the student writes in.
- **Vision:** invoices arrive as image or PDF content blocks, preceded by a label saying they are untrusted data.

### Typical flow: "pay this invoice"

```
user uploads invoice ─► agent
  get_overview                       (L0) learn currencies, balances, student ID
  list_payees                        (L0) match the invoice to the verified university payee
  compare_transfer_routes            (L0) exact amount due, purpose = tuition
  propose_transfer                   (L2) → policy.evaluate → pending action (locked quote, 15-minute expiry)
agent replies with a summary; the UI renders the approval card
user presses Approve ─► /api/actions ─► policy.evaluate again ─► executeTransfer ─► audit "approved"
```

### Flow: suspicious invoice

```
agent reads the invoice → notices the look-alike sender, the new bank account, 24-hour pressure,
and hidden text addressed to AI assistants
  report_security_concern            (L0) audit "flagged"
  (if it proposes adding the payee) propose_add_payee → policy flags "possible invoice fraud" (high risk)
agent warns the student and advises them to call the university on a known number
```

### Live steps
`POST /api/chat` streams newline-delimited JSON: one `{"type":"step"}` line per agent step as it happens, then a final `{"type":"done"}` line with the reply and the new signed state. `steps.ts` words each step from the tool's output (for example "Account ••••1639 matches your verified payee" or "≈USD 2,280 is within your USD 3,000 per-payment and USD 3,500 daily limits"), so the model can't claim a check passed when it didn't.

## 3. Tools

| Tool | Tier | Purpose |
|---|---|---|
| `get_overview` | L0 | Profile, balances (with USD equivalent), settings, pending count |
| `list_transactions` | L0 | Filter by days and category |
| `get_fx_quote` | L0 | Rate after margin, comparison with the 30-day average, trend |
| `compare_transfer_routes` | L0 | Prices five rails for an exact received amount and purpose |
| `analyze_budget` | L0 | 30-day spending by category against budget, and how long the money lasts |
| `get_country_guide` | L0 | Bank account, payments, tuition, arrival, costs |
| `list_payees` | L0 | Masked account numbers and verification status |
| `list_pending_actions` | L0 | Actions waiting for the user |
| `report_security_concern` | L0 | Writes a flagged entry to the audit log |
| `get_study_abroad_guide` | L0 | Checklist for the destination, student type and stay length across 10 topics (paperwork, SIM & internet, banking, housing, health, transport, apps, safety, academics, daily life), filterable by stage and topic, with official links and progress |
| `web_search` (server tool) | L0 | Finds the host university's official page; at most 3 searches per turn |
| `find_places_near_campus` | L0 | Demo places near campus with ratings, price vs. meal budget (monthly food budget ÷ 60), and Google Maps links |
| `verify_payee_details` | L0 | Code compares bank details from a document or message with saved payees: match, mismatch (hard block), look-alike or new |
| `request_limit_change` | L3 | Always refused and logged; the student changes limits in Settings (PIN plus a 24-hour wait for increases) |
| `mark_guide_step` | L1 | Ticks a checklist step when the student says it's done (progress only) |
| `set_budget` | L1 | Sets a category budget |
| `propose_currency_conversion` | L2 | Conversion between the user's own accounts |
| `propose_transfer` | L2 | Payment to a saved payee through a chosen rail |
| `propose_add_payee` | L3 | New beneficiary, screened for fraud and sanctions |

## 4. Core algorithms

**Route pricing** (`routes.ts`). For a received amount `R` in the target currency, rail margin `m`, flat fee `F` and percentage fee `p`:
`rate = mid × (1 − m)`, `principal = R / rate`, `fees = F + principal × p`, `total = principal + fees`.
The effective cost is `(total − R/mid) / (R/mid)`. Options are sorted with eligible rails first, cheapest first. Eligibility depends on the purpose (for example, a wallet top-up can't pay tuition), the rail's limit, and whether universities accept the rail for tuition.

**FX simulation** (`fx.ts`). Each currency's rate per USD follows a deterministic two-frequency wave of about ±1.9% around a base rate, keyed by day. This gives believable 30-day history and trends, and keeps tests reproducible.

**Policy engine** (`policy.ts`). This is a pure function `evaluate(state, action, now) → {decision: auto|confirm|block, tier, risk, reasons}` that checks:
- mode
- per-transaction and daily limits
- balance
- payee existence and currency
- rail eligibility for the purpose
- velocity (3 transfers in 10 minutes)
- large amounts (USD 10,000 or more is high risk)
- payees added recently
- tuition sent to a payee that isn't a university
- experimental rails
- a missing reference
- watchlist matches
- duplicate accounts
- look-alike payees with different bank details
- details taken from a document

`auto` is returned only for low-risk conversions between the user's own accounts that are under the autopilot limit.

**Budget** (`tools.ts` `budgetReport`). Spending over the last 30 days in each category is converted into the destination currency and compared with the budgets. Runway = total balance (in destination currency) ÷ monthly spending.

## 5. Data model (sandbox ledger)

`LedgerState` holds:
- `profile`: name, home and destination country, language, university, student ID
- `accounts[]`: currency, balance, label
- `transactions[]`: signed amount, category, description
- `payees[]`: verified flag, added by seed or user
- `budgets[]`
- `pending[]`: action, policy-generated summary, risk, reasons, expiry
- `audit[]`: actor, tier, decision, detail
- `settings`: mode, autopilot, per-transaction and daily limits

New sessions are seeded with realistic balances, about 30 days of spending scaled to the destination's typical living cost, a verified university payee, and a verified landlord.

## 6. Testing

`npm test` runs 26 Vitest unit tests across the policy engine, token integrity, FX and routes, and the full propose → approve → audit flow. These include negative tests: tampered tokens, expired and replayed approvals, Advisor mode, blocked rails, watchlist hits, and invoice-fraud detection.

## 7. Deployment

The app deploys to Vercel as a standard Next.js project. It needs two environment variables: `ANTHROPIC_API_KEY` and `LEDGER_SIGNING_SECRET` (at least 32 characters). Production refuses to sign tokens without the secret.
