# WeXchange — AI finance agent for exchange students

**FinTechathon 2026 · International Track · Topic C: Cross-border & Student Finance Assistant**

**Live demo:** [your-app].vercel.app  ·  **Source:** https://github.com/Ratchaproon/go2China

WeXchange is an AI agent that does real money tasks for students who move abroad to study or go on exchange. You pick your home country, your destination and your language. The agent then works inside a sandbox bank for you: it reads tuition invoices, checks who you're paying, compares cross-border payment routes, prepares payments and currency conversions, tracks your budget, and guides you through settling in.

> **The design rule:** the AI can propose, but only code checks and the student's approval can move money. Every step is written to an audit log you can export.

> **Sandbox only.** All balances, banks, FX rates, fees, places and payments are simulated. No real money moves, and the sign-in is a demo.

## Try it

| Step | What to do |
|---|---|
| Sign in | Phone or email, then the demo code **246810** (shown on screen), or **Continue with demo account** |
| Set up | Choose home country → destination (e.g. **Thailand → China**), exchange or degree, length of stay, language |
| Pay tuition | Press **Tuition invoice**. Watch the live "What I did" steps, then **Approve and pay** |
| Stop a scam | Press **Suspicious invoice**: same university name, different bank account. The code blocks it |
| Limits | Ask the AI "raise my limit to $5,000": refused and logged. Raise it yourself in **Settings** with PIN **2580**: takes effect in 24 hours |
| Evidence | **Activity → Export log (JSON)** |

## Features

| Area | What it does |
|---|---|
| **Tuition from an invoice** | Reads an uploaded invoice (image or PDF), checks the bank details against your verified payee in code, compares routes for the exact amount due, and prepares the payment with your student ID as the reference |
| **Payment routes** | Compares bank wire, university platform, online remittance, wallet top-up and an experimental stablecoin testnet rail on total cost, fees, speed and eligibility; shows the saving against a bank wire |
| **Live agent steps** | "What I did" streams each step as the agent works; every result ("Account ••••1639 matches your verified payee", "within your limits") is worded by code, not the AI |
| **Multi-currency wallet** | Home, destination and USD wallets; total balance; FX quotes against the 30-day average; a top-up suggestion when local money runs low |
| **Budget and runway** | Spending by category against budgets, over-budget warnings, and how many days your local money lasts |
| **Money log** | Log spending or income with **Add record** (instant, no AI call) or just tell the assistant ("I spent 45 on dinner", "my parents sent me 5,000 baht"); logged entries can be deleted |
| **To do** | The home screen lists what needs attention: approvals waiting, tuition due with its saving, money running low |
| **Study-abroad guide** | A checklist for every stage across 10 topics: paperwork (visa, residence permit), SIM & internet, banking, housing, health, transport, apps, safety, academics, daily life. Adapts to exchange vs degree and length of stay; links only to official pages; never fills in documents |
| **Places near campus** | Budget-aware food, cafés, groceries and stays with ratings and Google Maps links (**demo data**) |
| **Languages and countries** | 7 languages (English, 简体中文, ไทย, Tiếng Việt, Bahasa Indonesia, 日本語, 한국어); 23 countries, any home → destination pair; light theme by default, dark optional |

## Security

| Control | How |
|---|---|
| **AI can only propose** | Payments, conversions and new payees become approval cards. There is no tool to approve, change limits or change the agent mode |
| **Policy engine (code)** | Checks payee, limits, balance, route and transfer frequency on every proposal, and again at approval time |
| **Changed bank details** | Same name as a verified payee but a different account is a **hard block** (no approve button); look-alike names are high risk; sanctions watchlist screening |
| **Prompt injection** | Uploaded documents are untrusted data; hidden instructions are ignored and reported, and the code checks hold even if the AI were fooled |
| **Limits** | Defaults USD 3,000 per payment and 3,500 per day; hard maximums 5,000 and 10,000 enforced by the server. Lowering applies at once; raising needs the PIN and a 24-hour wait |
| **Permission tiers** | L0 Read, L1 Plan, L2 Move money (approval), L3 Trust (approval or PIN); modes Advisor / Co-pilot / Autopilot |
| **Approvals** | Expire after 15 minutes, work once, and re-run the checks |
| **Tamper-proof state** | The sandbox ledger is HMAC-signed by the server; the browser can read it but not change it |
| **Audit trail** | Every step logged with actor (Agent, You, Policy engine, System), tier and outcome; exportable as JSON |

Full details and the known-risk list: [docs/SECURITY.md](docs/SECURITY.md).

## Run it locally

Requirements: Node.js 20 or later and an Anthropic API key.

```bash
git clone https://github.com/Ratchaproon/go2China.git
cd go2China
npm install
cp .env.example .env.local   # then set ANTHROPIC_API_KEY and LEDGER_SIGNING_SECRET
npm run dev                  # http://localhost:3000
```

Generate a signing secret:

```bash
openssl rand -hex 32
```

## Deploy

A standard Next.js project: it deploys to Vercel (import the GitHub repo) or any Node host. Set these environment variables:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (server-side only) |
| `LEDGER_SIGNING_SECRET` | A random secret of at least 32 characters; production refuses to start without it |
| `ANTHROPIC_MODEL` | Optional; defaults to `claude-opus-5-5` |

## Tests

```bash
npm test
```

65 unit tests cover the policy engine (tiers, modes, limits, payee and sanctions screening, the changed-bank-details block), spending limits (hard maximums, PIN, the 24-hour wait, the refused AI request), the tamper-proof state token, the propose → approve → execute flow and its audit story (expiry, replay, re-checks), payment routes and savings, demo invoices fitting the limit in every destination, the study-abroad guide, and the money log.

## Documentation

- [Technical documentation](docs/TECHNICAL.md): architecture, agent loop, tools, algorithms and data model
- [Security self-assessment](docs/SECURITY.md): permission tiers, controls and known risks

## Project structure

```
src/
  app/
    page.tsx            Main app: header, tabs, chat with live steps, bottom nav
    api/session         Create a sandbox ledger for a profile
    api/chat            Run one agent turn, streaming steps (Claude, tool use)
    api/actions         Approve or reject a pending action (the only path that moves money)
    api/settings        Language, agent mode, limits (PIN + 24-hour wait to raise)
    api/record          Log income or spending, or delete an entry (no AI call)
    api/guide           Tick checklist steps
  components/           Login, onboarding, chat cards, wallet, activity, settings, guide, places
  lib/
    agent.ts            Agent loop and system prompt
    tools.ts            Tool definitions and handlers, each with a permission tier
    policy.ts           Policy engine: limits, payee checks, sanctions, risk
    limits.ts           Limit rules: hard maximums, PIN, cooling-off period
    steps.ts            Code-worded "What I did" steps
    actions.ts          Human-in-the-loop approve / reject
    ledger.ts           Sandbox bank: accounts, transactions, payees, audit log, money log
    token.ts            HMAC-signed stateless ledger token
    fx.ts, routes.ts    Sandbox FX engine and payment rails
    guide.ts            Study-abroad checklist content (official links)
    places.ts           Demo places near campus
    invoice.ts          Demo tuition invoices (normal and suspicious)
    countries.ts        Countries, currencies and study guides
    i18n.ts             Interface text in 7 languages
tests/                  Vitest unit tests
docs/                   Technical documentation and security self-assessment
```
