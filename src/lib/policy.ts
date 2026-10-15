import { getRoute } from "./routes";
import {
  type ActionParams, type LedgerState, type RiskLevel, type Tier,
  actionUsd, getAccount, outgoingTodayUsd, recentTransferCount,
} from "./ledger";
import { getCountry } from "./countries";

// Deterministic policy engine. The LLM never decides whether money moves:
// every proposed action is evaluated here, both when it is proposed and again
// when the user confirms it.

export type Decision = "auto" | "confirm" | "block";

export interface PolicyResult {
  decision: Decision;
  tier: Tier;
  risk: RiskLevel;
  reasons: string[];
}

export const LARGE_TRANSFER_USD = 10_000;
export const VELOCITY_WINDOW_MIN = 10;
export const VELOCITY_MAX = 3;
export const NEW_PAYEE_HOURS = 24;

/** Mock sanctions / fraud watchlist for the sandbox AML screen. */
export const WATCHLIST = [
  "Shadow Capital Holdings",
  "Northwind Exchange Bureau",
  "Golden Lotus Trading FZE",
  "Quick Visa Fee Collection Center",
];

export function normalizeName(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function tokens(s: string): Set<string> {
  return new Set(normalizeName(s).split(" ").filter((t) => t.length > 1));
}

export function nameSimilarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}

export function watchlistHit(name: string): string | undefined {
  return WATCHLIST.find((w) => nameSimilarity(w, name) >= 0.75);
}

const RISK_ORDER: RiskLevel[] = ["low", "medium", "high"];
function raise(cur: RiskLevel, to: RiskLevel): RiskLevel {
  return RISK_ORDER.indexOf(to) > RISK_ORDER.indexOf(cur) ? to : cur;
}

export function tierOf(a: ActionParams): Tier {
  return a.kind === "add_payee" ? "L3" : "L2";
}

export function evaluate(state: LedgerState, a: ActionParams, now = new Date()): PolicyResult {
  const tier = tierOf(a);
  const s = state.settings;
  const block: string[] = [];
  const reasons: string[] = [];
  let risk: RiskLevel = "low";

  if (s.agentMode === "advisor") {
    block.push("Agent is in Advisor mode: it can analyse and plan, but cannot prepare money movements or add payees.");
  }

  const usd = actionUsd(a, now);
  if (usd > s.perTxnLimitUsd) block.push(`Amount (≈USD ${usd.toFixed(0)}) exceeds the per-transaction limit of USD ${s.perTxnLimitUsd}.`);
  if (a.kind !== "add_payee") {
    const today = outgoingTodayUsd(state, now);
    if (today + usd > s.dailyLimitUsd) block.push(`Would exceed the daily limit of USD ${s.dailyLimitUsd} (already ≈USD ${today.toFixed(0)} today).`);
  }

  if (a.kind === "convert") {
    const p = a.params;
    if (p.fromCurrency === p.toCurrency) block.push("Source and target currency are the same.");
    if (!(p.amount > 0)) block.push("Amount must be positive.");
    const acct = getAccount(state, p.fromCurrency);
    if (!acct) block.push(`No ${p.fromCurrency} account.`);
    else if (acct.balance < p.amount) block.push(`Insufficient ${p.fromCurrency} balance.`);
  }

  if (a.kind === "transfer") {
    const p = a.params;
    const payee = state.payees.find((x) => x.id === p.payeeId);
    const route = getRoute(p.routeId);
    if (!(p.receiveAmount > 0)) block.push("Amount must be positive.");
    if (!payee) block.push("Payee not found. Payees must be added (and confirmed by the user) before paying them.");
    if (!route) block.push("Unknown payment route.");
    if (payee && payee.currency !== p.receiveCurrency) block.push(`Payee receives ${payee.currency}, not ${p.receiveCurrency}.`);
    if (route && !route.purposes.includes(p.purpose)) block.push(`${route.name} cannot be used for ${p.purpose} payments.`);
    if (route && p.purpose === "tuition" && !route.tuitionAccepted) block.push(`${route.name} is not accepted for tuition.`);
    if (route && usd > route.maxUsd) block.push(`${route.name} has a limit of USD ${route.maxUsd}.`);
    const acct = getAccount(state, p.sourceCurrency);
    if (!acct) block.push(`No ${p.sourceCurrency} account.`);
    else if (acct.balance < p.totalCost) block.push(`Insufficient ${p.sourceCurrency} balance (need ${p.totalCost}, have ${acct.balance}).`);
    if (recentTransferCount(state, VELOCITY_WINDOW_MIN, now) >= VELOCITY_MAX) {
      block.push(`Velocity limit: more than ${VELOCITY_MAX} transfers in ${VELOCITY_WINDOW_MIN} minutes. Try again later.`);
    }
    if (payee) {
      const ageH = (now.getTime() - Date.parse(payee.addedAt)) / 3_600_000;
      if (payee.addedBy === "user" && ageH < NEW_PAYEE_HOURS) {
        risk = raise(risk, "medium");
        reasons.push("First payment to a payee added in the last 24 hours.");
      }
      if (p.purpose === "tuition" && payee.kind !== "university") {
        risk = raise(risk, "high");
        reasons.push("Tuition is being sent to a payee that is not registered as a university.");
      }
    }
    if (route?.experimental) {
      risk = raise(risk, "medium");
      reasons.push("Experimental testnet rail.");
    }
    if (!p.reference || p.reference.trim().length < 3) {
      risk = raise(risk, "medium");
      reasons.push("No payment reference — the recipient may not be able to match the payment.");
    }
  }

  if (a.kind === "add_payee") {
    const p = a.params;
    const hit = watchlistHit(p.name);
    if (hit) block.push(`Payee name matches the sanctions/fraud watchlist entry "${hit}".`);
    try { getCountry(p.country); } catch { block.push(`Unknown country code ${p.country}.`); }
    if (!/^[0-9A-Za-z\- ]{6,34}$/.test(p.accountNumber)) block.push("Account number format looks invalid.");
    const dupe = state.payees.find((x) => x.accountNumber.replace(/\W/g, "") === p.accountNumber.replace(/\W/g, ""));
    if (dupe) block.push(`This account is already saved as payee "${dupe.name}".`);
    for (const existing of state.payees) {
      if (existing.verified && nameSimilarity(existing.name, p.name) >= 0.6 && existing.accountNumber !== p.accountNumber) {
        risk = raise(risk, "high");
        reasons.push(
          `Possible invoice fraud: "${p.name}" looks like your verified payee "${existing.name}", but the bank account is different. Call the recipient on a number you already know before approving.`,
        );
      }
    }
    if (p.source === "uploaded_document") {
      risk = raise(risk, "medium");
      reasons.push("Bank details were read from an uploaded document. Verify them through an official channel.");
    }
    if (risk === "low") reasons.push("New beneficiary — confirm the details are correct.");
  }

  if (usd >= LARGE_TRANSFER_USD) {
    risk = raise(risk, "high");
    reasons.push(`Large amount (≥ USD ${LARGE_TRANSFER_USD.toLocaleString("en")}): enhanced review, keep proof of purpose.`);
  }

  if (block.length) return { decision: "block", tier, risk: "high", reasons: [...block, ...reasons] };

  const canAuto = a.kind === "convert" && s.agentMode === "autopilot" && usd <= s.autoApproveLimitUsd && risk === "low";
  return { decision: canAuto ? "auto" : "confirm", tier, risk, reasons };
}
