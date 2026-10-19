import { getRoute } from "./routes";
import {
  type ActionParams, type LedgerState, type RiskLevel, type Tier,
  actionUsd, getAccount, outgoingTodayUsd, recentTransferCount,
} from "./ledger";
import { getCountry } from "./countries";
import { effectiveLimit } from "./limits";

// Deterministic policy engine. The LLM never decides whether money moves:
// every proposed action is evaluated here, both when it is proposed and again
// when the user confirms it.

export type Decision = "auto" | "confirm" | "block";

export type CheckId = "check_payee" | "check_limits" | "check_balance" | "check_route" | "check_velocity" | "check_mode";

/** One deterministic check and its outcome, worded by code (never by the model). */
export interface PolicyCheck {
  id: CheckId;
  ok: boolean;
  detail: string;
}

export interface PolicyResult {
  decision: Decision;
  tier: Tier;
  risk: RiskLevel;
  reasons: string[];
  checks: PolicyCheck[];
}

const CHECK_ORDER: CheckId[] = ["check_payee", "check_limits", "check_balance", "check_route", "check_velocity", "check_mode"];

const last4 = (n: string) => `••••${n.replace(/\W/g, "").slice(-4)}`;

/** Above this, a payment is flagged for extra care (it can still be approved within limits). */
export const LARGE_TRANSFER_USD = 2_500;
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
  const results = new Map<CheckId, PolicyCheck>();
  const pass = (id: CheckId, detail: string) => {
    if (!results.has(id)) results.set(id, { id, ok: true, detail });
  };
  const fail = (id: CheckId, detail: string) => {
    block.push(detail);
    const prev = results.get(id);
    results.set(id, prev && !prev.ok ? { id, ok: false, detail: `${prev.detail} ${detail}` } : { id, ok: false, detail });
  };

  if (s.agentMode === "advisor") {
    fail("check_mode", "Agent is in Advisor mode: it can analyse and plan, but cannot prepare money movements or add payees.");
  }

  const usd = actionUsd(a, now);
  if (a.kind !== "add_payee") {
    const today = outgoingTodayUsd(state, now);
    const perTxn = effectiveLimit(state, "perTxnLimitUsd");
    const daily = effectiveLimit(state, "dailyLimitUsd");
    if (usd > perTxn) fail("check_limits", `Amount (≈USD ${usd.toFixed(0)}) exceeds your per-payment limit of USD ${perTxn.toLocaleString("en")}.`);
    if (today + usd > daily) fail("check_limits", `Would exceed your daily limit of USD ${daily.toLocaleString("en")} (already ≈USD ${today.toFixed(0)} today).`);
    pass("check_limits", `≈USD ${usd.toFixed(0)} is within your USD ${perTxn.toLocaleString("en")} per-payment and USD ${daily.toLocaleString("en")} daily limits.`);
  }

  if (a.kind === "convert") {
    const p = a.params;
    if (p.fromCurrency === p.toCurrency) fail("check_route", "Source and target currency are the same.");
    if (!(p.amount > 0)) fail("check_balance", "Amount must be positive.");
    const acct = getAccount(state, p.fromCurrency);
    if (!acct) fail("check_balance", `No ${p.fromCurrency} account.`);
    else if (acct.balance < p.amount) fail("check_balance", `Insufficient ${p.fromCurrency} balance.`);
    pass("check_balance", `Enough ${p.fromCurrency} in your account.`);
  }

  if (a.kind === "transfer") {
    const p = a.params;
    const payee = state.payees.find((x) => x.id === p.payeeId);
    const route = getRoute(p.routeId);
    if (!(p.receiveAmount > 0)) fail("check_balance", "Amount must be positive.");
    if (!payee) fail("check_payee", "Payee not found. Payees must be added (and confirmed by the user) before paying them.");
    else if (!payee.verified) fail("check_payee", `${payee.name} is not a verified payee.`);
    else if (payee.currency !== p.receiveCurrency) fail("check_payee", `Payee receives ${payee.currency}, not ${p.receiveCurrency}.`);
    else pass("check_payee", `Paying ${payee.name}, account ${last4(payee.accountNumber)}, which matches your verified payee.`);
    if (!route) fail("check_route", "Unknown payment route.");
    if (route && !route.purposes.includes(p.purpose)) fail("check_route", `${route.name} cannot be used for ${p.purpose} payments.`);
    if (route && p.purpose === "tuition" && !route.tuitionAccepted) fail("check_route", `${route.name} is not accepted for tuition.`);
    if (route && usd > route.maxUsd) fail("check_route", `${route.name} has a limit of USD ${route.maxUsd}.`);
    if (route) pass("check_route", `${route.name} can be used for ${p.purpose} payments.`);
    const acct = getAccount(state, p.sourceCurrency);
    if (!acct) fail("check_balance", `No ${p.sourceCurrency} account.`);
    else if (acct.balance < p.totalCost) fail("check_balance", `Insufficient ${p.sourceCurrency} balance (need ${p.totalCost}, have ${acct.balance}).`);
    pass("check_balance", `Enough ${p.sourceCurrency} in your account.`);
    if (recentTransferCount(state, VELOCITY_WINDOW_MIN, now) >= VELOCITY_MAX) {
      fail("check_velocity", `Velocity limit: more than ${VELOCITY_MAX} transfers in ${VELOCITY_WINDOW_MIN} minutes. Try again later.`);
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
    if (hit) fail("check_payee", `Payee name matches the sanctions/fraud watchlist entry "${hit}".`);
    try { getCountry(p.country); } catch { fail("check_payee", `Unknown country code ${p.country}.`); }
    if (!/^[0-9A-Za-z\- ]{6,34}$/.test(p.accountNumber)) fail("check_payee", "Account number format looks invalid.");
    const dupe = state.payees.find((x) => x.accountNumber.replace(/\W/g, "") === p.accountNumber.replace(/\W/g, ""));
    if (dupe) fail("check_payee", `This account is already saved as payee "${dupe.name}".`);
    for (const existing of state.payees) {
      if (!existing.verified || existing.accountNumber.replace(/\W/g, "") === p.accountNumber.replace(/\W/g, "")) continue;
      if (normalizeName(existing.name) === normalizeName(p.name)) {
        // Changed bank details under a trusted name: the most common payment scam. Never approvable.
        fail(
          "check_payee",
          `Account ${last4(p.accountNumber)} doesn't match your verified payee "${existing.name}" (${last4(existing.accountNumber)}). Bank details for a saved payee can't be changed from a document or chat. Contact them through their official website or a phone number you already know.`,
        );
      } else if (nameSimilarity(existing.name, p.name) >= 0.6) {
        risk = raise(risk, "high");
        reasons.push(
          `Possible invoice fraud: "${p.name}" looks like your verified payee "${existing.name}", but the bank account is different. Call the recipient on a number you already know before approving.`,
        );
      }
    }
    pass("check_payee", "New payee: not on the watchlist and not a copy of a saved payee.");
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

  const checks = CHECK_ORDER.flatMap((id) => (results.has(id) ? [results.get(id)!] : []));
  if (block.length) return { decision: "block", tier, risk: "high", reasons: [...block, ...reasons], checks };

  const canAuto = a.kind === "convert" && s.agentMode === "autopilot" && usd <= effectiveLimit(state, "autoApproveLimitUsd") && risk === "low";
  return { decision: canAuto ? "auto" : "confirm", tier, risk, reasons, checks };
}

export type PayeeMatch = "match" | "mismatch" | "lookalike" | "new";

/**
 * Compare bank details read from a document or message with saved payees.
 * The model must call this instead of judging a match itself.
 */
export function checkPayeeDetails(state: LedgerState, name: string, accountNumber: string): { result: PayeeMatch; check: PolicyCheck } {
  const acct = accountNumber.replace(/\W/g, "");
  for (const p of state.payees) {
    if (!p.verified || normalizeName(p.name) !== normalizeName(name)) continue;
    if (p.accountNumber.replace(/\W/g, "") === acct) {
      return { result: "match", check: { id: "check_payee", ok: true, detail: `Account ${last4(acct)} matches your verified payee "${p.name}".` } };
    }
    return {
      result: "mismatch",
      check: {
        id: "check_payee", ok: false,
        detail: `Account ${last4(acct)} doesn't match your verified payee "${p.name}" (${last4(p.accountNumber)}). No payment prepared. Bank details for a saved payee can't be changed from a document or chat. Contact them through their official website or a phone number you already know.`,
      },
    };
  }
  const similar = state.payees.find((p) => p.verified && nameSimilarity(p.name, name) >= 0.6);
  if (similar) {
    return {
      result: "lookalike",
      check: { id: "check_payee", ok: false, detail: `"${name}" looks like your verified payee "${similar.name}" but isn't the same, and the account (${last4(acct)}) is different. Treat as possible invoice fraud.` },
    };
  }
  return { result: "new", check: { id: "check_payee", ok: false, detail: `"${name}" (${last4(acct)}) is not a saved payee. Adding it needs your approval.` } };
}
