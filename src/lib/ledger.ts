import { type CurrencyCode, getCountry, guideFor, roundTo, CURRENCIES } from "./countries";
import { fromUsd, toUsd } from "./fx";
import { getRoute, type Purpose } from "./routes";
import type { StudentType } from "./paperwork";

// The sandbox bank. All balances and transactions are simulated; nothing here
// touches a real financial institution.

export type Lang = "en" | "zh" | "th" | "vi" | "id" | "ja" | "ko";

export interface Profile {
  name: string;
  homeCountry: string;
  destCountry: string;
  language: Lang;
  university: string;
  studentId: string;
  /** Older sessions may lack these; read via paperworkProfile(). */
  studentType?: StudentType;
  stayMonths?: number;
}

export interface Account {
  currency: CurrencyCode;
  balance: number;
  label: string;
}

export type Category =
  | "rent" | "food" | "transport" | "phone" | "books" | "entertainment" | "shopping"
  | "tuition" | "transfer" | "income" | "fx" | "fees" | "other";

export const SPEND_CATEGORIES: Category[] = ["rent", "food", "transport", "phone", "books", "entertainment", "shopping", "other"];

export interface Txn {
  id: string;
  ts: string;
  currency: CurrencyCode;
  /** Signed: negative = money out. */
  amount: number;
  category: Category;
  description: string;
  counterparty?: string;
  routeId?: string;
}

export type PayeeKind = "university" | "landlord" | "person" | "merchant";

export interface Payee {
  id: string;
  name: string;
  kind: PayeeKind;
  country: string;
  currency: CurrencyCode;
  bankName: string;
  accountNumber: string;
  swift?: string;
  /** Verified = details confirmed through an official channel (seeded) or approved by the user. */
  verified: boolean;
  addedBy: "seed" | "user";
  addedAt: string;
}

export type ActionKind = "transfer" | "convert" | "add_payee";

export interface TransferParams {
  payeeId: string;
  sourceCurrency: CurrencyCode;
  receiveAmount: number;
  receiveCurrency: CurrencyCode;
  routeId: string;
  purpose: Purpose;
  reference: string;
  /** Locked quote at proposal time (source currency). */
  totalCost: number;
  feeTotal: number;
}

export interface ConvertParams {
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  amount: number;
  receive: number;
  rate: number;
}

export interface AddPayeeParams {
  name: string;
  kind: PayeeKind;
  country: string;
  currency: CurrencyCode;
  bankName: string;
  accountNumber: string;
  swift?: string;
  source: "user_message" | "uploaded_document";
}

export type ActionParams =
  | { kind: "transfer"; params: TransferParams }
  | { kind: "convert"; params: ConvertParams }
  | { kind: "add_payee"; params: AddPayeeParams };

export type RiskLevel = "low" | "medium" | "high";

export interface PendingAction {
  id: string;
  action: ActionParams;
  summary: string;
  agentReason: string;
  tier: Tier;
  risk: RiskLevel;
  riskReasons: string[];
  createdAt: string;
  expiresAt: string;
}

/**
 * Permission tiers:
 *  L0 read      — view balances, quotes, guides
 *  L1 plan      — budgets and drafts; no money moves
 *  L2 transact  — money movement (conversions, transfers)
 *  L3 trust     — beneficiary management (adding payees)
 */
export type Tier = "L0" | "L1" | "L2" | "L3";

export type AgentMode = "advisor" | "copilot" | "autopilot";

export interface Settings {
  /** advisor: read/plan only. copilot: may propose, user confirms all. autopilot: small own-account conversions run automatically. */
  agentMode: AgentMode;
  autoApproveLimitUsd: number;
  perTxnLimitUsd: number;
  dailyLimitUsd: number;
}

export type AuditDecision = "read" | "auto_executed" | "pending_confirmation" | "approved" | "rejected" | "blocked" | "expired" | "flagged";

export interface AuditEntry {
  id: string;
  ts: string;
  actor: "agent" | "user" | "system";
  action: string;
  tier: Tier;
  decision: AuditDecision;
  detail: string;
  refId?: string;
}

export interface Budget {
  category: Category;
  monthlyLimit: number; // destination currency
}

export interface LedgerState {
  v: 1;
  sessionId: string;
  createdAt: string;
  profile: Profile;
  accounts: Account[];
  transactions: Txn[];
  payees: Payee[];
  budgets: Budget[];
  pending: PendingAction[];
  audit: AuditEntry[];
  settings: Settings;
  /** Paperwork step id → done. Progress is tracked only; the app never files documents. */
  paperwork?: Record<string, boolean>;
}

export const DEFAULT_SETTINGS: Settings = {
  agentMode: "copilot",
  autoApproveLimitUsd: 50,
  perTxnLimitUsd: 15_000,
  dailyLimitUsd: 20_000,
};

const MAX_AUDIT = 200;
const MAX_TXNS = 150;

export function uid(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

/** Deterministic pseudo-random for seeding, so a profile always gets similar demo data. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967295;
  };
}

function demoAccountNumber(rand: () => number): string {
  let s = "";
  for (let i = 0; i < 12; i++) s += Math.floor(rand() * 10);
  return s;
}

export function maskAccount(n: string): string {
  return n.length <= 4 ? n : `••••${n.slice(-4)}`;
}

export function createInitialState(profile: Profile, now = new Date()): LedgerState {
  const home = getCountry(profile.homeCountry);
  const dest = getCountry(profile.destCountry);
  const guide = guideFor(dest.code);
  const rand = seeded(`${home.code}-${dest.code}`);
  const dc = dest.currency;
  const hc = home.currency;

  const monthly = guide.monthlyLivingCost > 0 ? guide.monthlyLivingCost : roundTo(dc, fromUsd(dc, 1100, now));

  const accounts: Account[] = [
    { currency: hc, balance: roundTo(hc, fromUsd(hc, 9000, now)), label: `${home.name} savings` },
  ];
  if (dc !== hc) accounts.push({ currency: dc, balance: roundTo(dc, monthly * 0.35), label: `${dest.name} wallet` });
  if (hc !== "USD" && dc !== "USD") accounts.push({ currency: "USD", balance: 300, label: "USD wallet" });

  // ~30 days of everyday spending in the destination currency.
  const shares: [Category, number, string][] = [
    ["food", 0.27, "Canteen / groceries"],
    ["transport", 0.07, "Metro & bus"],
    ["phone", 0.03, "Mobile plan"],
    ["books", 0.05, "Textbooks & supplies"],
    ["entertainment", 0.09, "Weekend outing"],
    ["shopping", 0.08, "Daily necessities"],
  ];
  const txns: Txn[] = [];
  const day = 86_400_000;
  txns.push({
    id: uid("tx"), ts: new Date(now.getTime() - 28 * day).toISOString(), currency: dc,
    amount: -roundTo(dc, monthly * 0.38), category: "rent", description: "Monthly rent", counterparty: "Campus Residence Landlord",
  });
  for (const [cat, share, desc] of shares) {
    const n = cat === "food" ? 14 : cat === "transport" ? 6 : cat === "phone" ? 1 : 3;
    for (let i = 0; i < n; i++) {
      const amt = (monthly * share) / n * (0.6 + rand() * 0.8);
      txns.push({
        id: uid("tx"), ts: new Date(now.getTime() - Math.floor(rand() * 29 + 1) * day).toISOString(),
        currency: dc, amount: -roundTo(dc, amt), category: cat, description: desc,
      });
    }
  }
  txns.push({
    id: uid("tx"), ts: new Date(now.getTime() - 20 * day).toISOString(), currency: hc,
    amount: roundTo(hc, fromUsd(hc, 800, now)), category: "income", description: "Allowance from family", counterparty: "Family",
  });
  txns.sort((a, b) => b.ts.localeCompare(a.ts));

  const university = profile.university || `Demo University of ${dest.name}`;
  const payees: Payee[] = [
    {
      id: "payee_university", name: university, kind: "university", country: dest.code, currency: dc,
      bankName: `${dest.name} Commercial Bank (Sandbox)`, accountNumber: demoAccountNumber(rand), swift: "SBXBANK1",
      verified: true, addedBy: "seed", addedAt: now.toISOString(),
    },
    {
      id: "payee_landlord", name: "Campus Residence Landlord", kind: "landlord", country: dest.code, currency: dc,
      bankName: `${dest.name} City Bank (Sandbox)`, accountNumber: demoAccountNumber(rand),
      verified: true, addedBy: "seed", addedAt: now.toISOString(),
    },
  ];

  const budgets: Budget[] = [
    { category: "rent", monthlyLimit: roundTo(dc, monthly * 0.4) },
    { category: "food", monthlyLimit: roundTo(dc, monthly * 0.25) },
    { category: "transport", monthlyLimit: roundTo(dc, monthly * 0.07) },
    { category: "entertainment", monthlyLimit: roundTo(dc, monthly * 0.07) },
    { category: "shopping", monthlyLimit: roundTo(dc, monthly * 0.08) },
  ];

  return {
    v: 1,
    sessionId: uid("sess"),
    createdAt: now.toISOString(),
    profile: { ...profile, university },
    accounts, transactions: txns, payees, budgets,
    pending: [],
    audit: [{
      id: uid("au"), ts: now.toISOString(), actor: "system", action: "session_created", tier: "L0",
      decision: "read", detail: `Sandbox session for ${home.name} → ${dest.name}`,
    }],
    settings: { ...DEFAULT_SETTINGS },
    paperwork: {},
  };
}

export function paperworkProfile(state: LedgerState) {
  return {
    destCountry: state.profile.destCountry,
    studentType: state.profile.studentType ?? "degree",
    stayMonths: state.profile.stayMonths ?? 12,
  };
}

export function audit(state: LedgerState, e: Omit<AuditEntry, "id" | "ts">, now = new Date()): AuditEntry {
  const entry: AuditEntry = { id: uid("au"), ts: now.toISOString(), ...e };
  state.audit.unshift(entry);
  if (state.audit.length > MAX_AUDIT) state.audit.length = MAX_AUDIT;
  return entry;
}

export function getAccount(state: LedgerState, currency: CurrencyCode): Account | undefined {
  return state.accounts.find((a) => a.currency === currency);
}

function ensureAccount(state: LedgerState, currency: CurrencyCode): Account {
  let acct = getAccount(state, currency);
  if (!acct) {
    acct = { currency, balance: 0, label: `${currency} wallet` };
    state.accounts.push(acct);
  }
  return acct;
}

function pushTxn(state: LedgerState, t: Omit<Txn, "id">): Txn {
  const txn = { id: uid("tx"), ...t };
  state.transactions.unshift(txn);
  if (state.transactions.length > MAX_TXNS) state.transactions.length = MAX_TXNS;
  return txn;
}

/** Total outgoing value (USD) executed today, for daily-limit checks. */
export function outgoingTodayUsd(state: LedgerState, now = new Date()): number {
  const today = now.toISOString().slice(0, 10);
  return state.transactions
    .filter((t) => t.ts.slice(0, 10) === today && t.amount < 0 && (t.category === "tuition" || t.category === "transfer" || t.category === "rent" || t.category === "fx"))
    .reduce((s, t) => s + toUsd(t.currency, -t.amount, now), 0);
}

export function recentTransferCount(state: LedgerState, minutes: number, now = new Date()): number {
  const since = now.getTime() - minutes * 60_000;
  return state.transactions.filter((t) => (t.category === "tuition" || t.category === "transfer" || t.category === "rent") && t.amount < 0 && Date.parse(t.ts) >= since).length;
}

export function actionUsd(a: ActionParams, now = new Date()): number {
  switch (a.kind) {
    case "transfer": return toUsd(a.params.sourceCurrency, a.params.totalCost, now);
    case "convert": return toUsd(a.params.fromCurrency, a.params.amount, now);
    case "add_payee": return 0;
  }
}

export function executeConvert(state: LedgerState, p: ConvertParams, now = new Date()) {
  const from = getAccount(state, p.fromCurrency);
  if (!from) throw new Error(`No ${p.fromCurrency} account`);
  if (from.balance < p.amount) throw new Error(`Insufficient ${p.fromCurrency} balance`);
  const to = ensureAccount(state, p.toCurrency);
  from.balance = roundTo(p.fromCurrency, from.balance - p.amount);
  to.balance = roundTo(p.toCurrency, to.balance + p.receive);
  pushTxn(state, { ts: now.toISOString(), currency: p.fromCurrency, amount: -p.amount, category: "fx", description: `Converted to ${p.toCurrency}` });
  pushTxn(state, { ts: now.toISOString(), currency: p.toCurrency, amount: p.receive, category: "fx", description: `Converted from ${p.fromCurrency} @ ${p.rate.toFixed(4)}` });
}

export function executeTransfer(state: LedgerState, p: TransferParams, now = new Date()) {
  const payee = state.payees.find((x) => x.id === p.payeeId);
  if (!payee) throw new Error("Unknown payee");
  const src = getAccount(state, p.sourceCurrency);
  if (!src) throw new Error(`No ${p.sourceCurrency} account`);
  if (src.balance < p.totalCost) throw new Error(`Insufficient ${p.sourceCurrency} balance`);
  const route = getRoute(p.routeId);
  if (!route) throw new Error("Unknown route");
  src.balance = roundTo(p.sourceCurrency, src.balance - p.totalCost);
  const category: Category = p.purpose === "tuition" ? "tuition" : p.purpose === "rent" ? "rent" : "transfer";
  pushTxn(state, {
    ts: now.toISOString(), currency: p.sourceCurrency, amount: -p.totalCost, category,
    description: `${route.name}: ${CURRENCIES[p.receiveCurrency].symbol}${p.receiveAmount.toLocaleString("en")} to ${payee.name} (ref ${p.reference})`,
    counterparty: payee.name, routeId: route.id,
  });
}

export function executeAddPayee(state: LedgerState, p: AddPayeeParams, now = new Date()): Payee {
  const payee: Payee = {
    id: uid("payee"), name: p.name, kind: p.kind, country: p.country, currency: p.currency,
    bankName: p.bankName, accountNumber: p.accountNumber, swift: p.swift,
    verified: true, addedBy: "user", addedAt: now.toISOString(),
  };
  state.payees.push(payee);
  return payee;
}

