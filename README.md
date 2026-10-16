# go2China — AI finance agent for international students

**FinTechathon 2026 · International Track · Topic C: Cross-border & Student Finance Assistant**

go2China is an AI agent that handles real money tasks for students who move abroad to study or go on exchange. You pick your home country, your destination and your language. The agent then works inside a sandbox bank for you: it reads tuition invoices, compares cross-border payment routes, prepares payments and currency conversions, tracks your budget, and explains how money works in the new country.

Every money movement goes through a deterministic policy engine and needs your approval, unless it's a tiny conversion between your own accounts that you explicitly allowed. Everything the agent does is written to an audit log that you can export.

> **Sandbox only.** All balances, banks, FX rates, fees and payments are simulated. No real money moves.

## Features

| Feature | What the agent does |
|---|---|
| Tuition from an invoice | Reads an uploaded invoice (image or PDF), matches it to your university's verified payee, compares routes for the exact amount due, and proposes the payment with your student ID in the reference |
| Remittance route comparison | Compares bank wire, university platform, online remittance, wallet top-up and an experimental stablecoin testnet rail on total cost, fees, speed and eligibility |
| Multi-currency wallet | Balances in home, destination and USD accounts; FX quotes compared with the 30-day average |
| Budget coach | Spending by category against monthly budgets, and how many months your money will last |
| Study-abroad guide | A checklist for every stage (before you leave → arrival → during your stay → going home) across 10 topics: **paperwork** (visa, residence permit, registration), **SIM & internet**, **banking**, **housing**, **health**, **transport**, **apps to install**, **safety** (emergency numbers, scams), **academics** (nomination, learning agreement, transcripts) and **daily life**. It adapts to exchange vs degree and length of stay (e.g. China X2 vs X1 + residence permit). Links go only to official government or university pages; the app never fills in or submits documents |
| Places near campus | Budget-aware food, café, grocery, hotel and hostel suggestions near campus, with rating, sample reviews, price in local and home currency, a "fits your meal budget" badge, student discounts, a Google Maps embed, and walking directions. **Places, ratings and reviews are demo data**, ready to swap for a real places API |
| Arrival guide | Bank account opening, payment apps, paying tuition and an arrival checklist for 10 destinations, with generic guidance for others |
| Fraud and prompt-injection defence | Flags look-alike payees with changed bank details, urgency tactics, and instructions hidden in documents; reports them to the audit log |
| 7 languages | English, 简体中文, ไทย, Tiếng Việt, Bahasa Indonesia, 日本語, 한국어. The agent replies in your language |
| 23 countries | Any home → destination pair |

## Quick start

Requirements: Node.js 20 or later and an Anthropic API key.

```bash
npm install
cp .env.example .env.local   # then fill in ANTHROPIC_API_KEY and LEDGER_SIGNING_SECRET
npm run dev                  # http://localhost:3000
```

Generate a signing secret:

```bash
openssl rand -hex 32
```

### Try the demo flow
1. Choose **Thailand → China**, pick a language, and press **Start**.
2. Press **📄 Tuition invoice**. The agent reads it, compares routes, and proposes a payment. Approve it in the card.
3. Press **🚩 Suspicious invoice**. The agent detects the changed bank details, the urgency and the hidden instruction to AI, and reports a security concern. Nothing is paid.
4. Open **Activity** to see every step with its permission tier. Export it as JSON to use as execution evidence.

## Tests

```bash
npm test
```

The unit tests cover the policy engine (tiers, modes, limits, fraud and sanctions screening), the tamper-proof state token, and the propose → approve flow (no money moves before approval, expiry, re-checks at approval time, replay protection).

## Deploy

The app is a standard Next.js project, so it deploys to Vercel or any Node host. Set `ANTHROPIC_API_KEY` and `LEDGER_SIGNING_SECRET` (at least 32 characters) as environment variables.

## Documentation

- [Technical documentation](docs/TECHNICAL.md): architecture, agent loop, tools and data model
- [Security self-assessment](docs/SECURITY.md): permission tiers, controls and known risks

## Project structure

```
src/
  app/            Next.js pages and API routes (session, chat, actions, settings)
  components/     UI: chat cards, wallet, activity log, settings, onboarding
  lib/
    agent.ts      Claude agent loop and system prompt
    tools.ts      Tool definitions and handlers, each with a permission tier
    policy.ts     Deterministic policy engine (limits, AML/fraud screening)
    actions.ts    Human-in-the-loop approve/reject execution path
    ledger.ts     Sandbox bank: accounts, transactions, payees, audit log
    token.ts      HMAC-signed stateless ledger token
    fx.ts         Sandbox FX engine
    routes.ts     Simulated cross-border payment rails
    countries.ts  Country, currency and study-guide data
    i18n.ts       UI translations
tests/            Vitest unit tests
```
