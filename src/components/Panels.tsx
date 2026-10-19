"use client";
import { useMemo, useState } from "react";
import { ArrowLeftRight, Check, Download, LogOut } from "lucide-react";
import { CATEGORY_ICON, Ic } from "./icons";
import { formatMoney, getCountry, roundTo } from "@/lib/countries";
import { midRate, quote } from "@/lib/fx";
import { CATEGORY_LABELS, LANGS, type Dict, fmt } from "@/lib/i18n";
import type { AgentMode, AuditDecision, AuditEntry, Lang, LedgerState, Settings, Tier } from "@/lib/ledger";
import { budgetReport } from "@/lib/tools";
import { DEMO_PIN, HARD_MAX, LIMIT_KEYS, type LimitKey } from "@/lib/limits";
import { compareRoutes, savingVsWire } from "@/lib/routes";
import { invoiceAmount } from "@/lib/invoice";
import { PendingCard } from "./Cards";

export function AccountsStrip({ state, lang, d }: { state: LedgerState; lang: Lang; d: Dict }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {state.accounts.map((a) => (
        <div key={a.currency} className="min-w-36 shrink-0 rounded-xl border border-border bg-surface px-3 py-2">
          <p className="truncate text-xs text-muted">{a.label}</p>
          <p className="tabular font-bold">{formatMoney(a.currency, a.balance, lang)}</p>
        </div>
      ))}
      {state.pending.length > 0 && (
        <div className="shrink-0 rounded-xl border border-brand bg-brand-soft px-3 py-2 text-sm font-semibold text-brand">
          {state.pending.length} {d.pendingCount}
        </div>
      )}
      <span className="sr-only">{d.accounts}</span>
    </div>
  );
}

const TIER_STYLE: Record<Tier, string> = {
  L0: "bg-surface-2 text-muted",
  L1: "bg-brand-soft text-brand",
  L2: "bg-warn-soft text-warn",
  L3: "bg-navy text-white",
};

export function TierBadge({ tier, d }: { tier: Tier; d: Dict }) {
  return <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${TIER_STYLE[tier]}`}>{d.tiers[tier]}</span>;
}

// Category colours for the spending bar, in order of spend.
const BAR_COLORS = ["bg-brand", "bg-navy", "bg-brand/45", "bg-muted/40", "bg-warn", "bg-ok", "bg-brand/25", "bg-muted/20"];

/** Round up to two significant figures, so suggested amounts look like ones a person would choose. */
function niceAmount(x: number): number {
  if (x <= 0) return 0;
  const mag = 10 ** Math.max(0, Math.floor(Math.log10(x)) - 1);
  return Math.ceil(x / mag) * mag;
}

/**
 * Should the student top up their destination wallet? Aims for about 30 days of
 * spending; also returns the most over-budget category, so the suggestion can
 * say why. Shared by the Wallet and the home "To do" card.
 */
export function topUpSuggestion(state: LedgerState, report = budgetReport(state)) {
  const hc = getCountry(state.profile.homeCountry).currency;
  const dc = getCountry(state.profile.destCountry).currency;
  const destBal = state.accounts.find((a) => a.currency === dc)?.balance ?? 0;
  const daily = report.totalSpent / 30;
  const runwayDays = daily > 0 ? Math.floor(destBal / daily) : 0;
  const q = quote(hc, dc, 1);
  const homeAmt = hc !== dc && runwayDays < 30 ? niceAmount((30 * daily - destBal) / q.rate) : 0;
  const receive = roundTo(dc, homeAmt * q.rate);
  const overLimit = homeAmt / midRate("USD", hc) > state.settings.autoApproveLimitUsd;
  const over = report.categories.filter((c) => c.status === "over").sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  return { hc, dc, destBal, daily, runwayDays, q, homeAmt, receive, overLimit, over };
}

export function WalletPanel({
  state, lang, d, busy, onDecide, onAsk,
}: {
  state: LedgerState; lang: Lang; d: Dict; busy: boolean;
  onDecide: (id: string, approve: boolean) => void; onAsk: (text: string) => void;
}) {
  const [dismissed, setDismissed] = useState(false);
  const labels = CATEGORY_LABELS[lang];
  const hc = getCountry(state.profile.homeCountry).currency;
  const dc = getCountry(state.profile.destCountry).currency;
  const report = useMemo(() => budgetReport(state), [state]);
  const total = state.accounts.reduce((s, a) => s + a.balance * midRate(a.currency, hc), 0);
  const { destBal, daily, runwayDays, q, homeAmt, receive, overLimit, over } = topUpSuggestion(state, report);
  const cats = [...report.categories].filter((c) => c.spent > 0).sort((a, b) => b.spent - a.spent);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.wallet}</h1>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="col-span-2 rounded-2xl bg-ink p-5 text-on-ink lg:col-span-1">
          <p className="text-sm font-medium opacity-85">{fmt(d.totalIn, { cur: hc })}</p>
          <p className="tabular mt-1 text-[1.7rem] font-bold leading-tight">{formatMoney(hc, total, lang)}</p>
          <p className="mt-1 text-xs opacity-75">{d.sandboxRates}</p>
        </div>
        {state.accounts.map((a) => (
          <div key={a.currency} className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
            <p className="truncate text-sm text-muted">{a.label}</p>
            <p className="tabular mt-1 text-lg font-bold sm:text-xl">{formatMoney(a.currency, a.balance, lang)}</p>
          </div>
        ))}
      </section>

      {state.pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-bold">{d.pendingTitle}</h2>
          {state.pending.map((p) => <PendingCard key={p.id} p={p} state={state} lang={lang} d={d} busy={busy} onDecide={onDecide} onAsk={onAsk} />)}
        </section>
      )}

      {homeAmt > 0 && !dismissed && (
        <section className="flex flex-col gap-4 rounded-2xl border border-brand/30 bg-surface p-4 sm:flex-row sm:items-center sm:p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <ArrowLeftRight aria-hidden className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-bold">{fmt(d.convertTitle, { from: formatMoney(hc, homeAmt, lang), to: formatMoney(dc, receive, lang) })}</p>
            <p className="mt-0.5 text-sm text-muted">
              {over && <>{fmt(d.overBudgetNote, { cat: labels[over.category] ?? over.category, n: (over.pct ?? 100) - 100 })} </>}
              {fmt(d.lastsDays, { cur: dc, n: runwayDays })}
              {q.trend === "better_than_usual" && <> {d.rateBetterNote}</>}
              {overLimit && <> {d.needsOk}</>}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => onAsk(fmt(d.convertPrompt, { from: formatMoney(hc, homeAmt, lang), to: dc }))}
              className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-on-ink"
            >
              {d.reviewConversion}
            </button>
            <button onClick={() => setDismissed(true)} className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">{d.notNow}</button>
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold">{d.spendingTitle}</h2>
            <p className="tabular text-sm text-muted">
              <b className="text-base text-text">{formatMoney(dc, report.totalSpent, lang)}</b> {fmt(d.ofBudget, { x: formatMoney(dc, report.totalBudget, lang) })}
            </p>
          </div>
          <div className="mt-4 flex h-3 gap-0.5 overflow-hidden rounded-full" aria-hidden>
            {cats.map((c, i) => (
              <div key={c.category} className={BAR_COLORS[i % BAR_COLORS.length]} style={{ width: `${(c.spent / report.totalSpent) * 100}%` }} />
            ))}
          </div>
          <ul className="mt-5 space-y-4">
            {cats.map((c, i) => {
              const share = Math.round((c.spent / report.totalSpent) * 100);
              const over = c.status === "over";
              return (
                <li key={c.category}>
                  <div className="tabular flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${BAR_COLORS[i % BAR_COLORS.length]}`} />
                      {labels[c.category] ?? c.category} <span className="font-normal text-muted">{share}%</span>
                    </span>
                    <span>
                      <b className={over ? "text-bad" : ""}>{formatMoney(dc, c.spent, lang)}</b>
                      {c.limit != null && <span className="text-muted"> / {formatMoney(dc, c.limit, lang)}</span>}
                    </span>
                  </div>
                  {c.limit != null && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${over ? "bg-bad" : c.status === "warning" ? "bg-warn" : "bg-brand"}`} style={{ width: `${Math.min(100, c.pct ?? 0)}%` }} />
                    </div>
                  )}
                  {over && <p className="mt-1 text-xs font-semibold text-bad">{fmt(d.overBy, { n: (c.pct ?? 100) - 100 })}</p>}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-lg font-bold">{d.runwayTitle}</h2>
          <p className="mt-3 flex items-baseline gap-2">
            <span className={`tabular text-5xl font-bold tracking-tight ${runwayDays < 14 ? "text-warn" : "text-brand"}`}>{runwayDays}</span>
            <span className="font-semibold text-muted">{fmt(d.daysLeft, { cur: dc })}</span>
          </p>
          <dl className="tabular mt-5 divide-y divide-border border-t border-border text-sm">
            <div className="flex justify-between py-2.5"><dt className="text-muted">{d.avgDaily}</dt><dd className="font-semibold">{formatMoney(dc, daily, lang)}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-muted">{fmt(d.inWallet, { cur: dc })}</dt><dd className="font-semibold">{formatMoney(dc, destBal, lang)}</dd></div>
            <div className="flex justify-between py-2.5"><dt className="text-muted">{d.runway}</dt><dd className="font-semibold">{report.runwayMonths} {d.months}</dd></div>
          </dl>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <h2 className="px-5 pb-2 pt-4 text-lg font-bold">{d.verifiedPayees}</h2>
        <ul className="divide-y divide-border border-t border-border">
          {state.payees.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-sm text-muted">{p.bankName}, ••••{p.accountNumber.slice(-4)}, {p.currency}</p>
              </div>
              {p.verified && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-semibold text-ok">{d.verified}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-surface">
        <h2 className="px-5 pb-2 pt-4 text-lg font-bold">{d.transactions}</h2>
        <ul className="divide-y divide-border border-t border-border">
          {state.transactions.slice(0, 30).map((tx) => {
            const Icon = CATEGORY_ICON[tx.category];
            return (
              <li key={tx.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tx.amount < 0 ? "bg-brand-soft text-brand" : "bg-ok-soft text-ok"}`}>
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{tx.description}</p>
                  <p className="text-xs text-muted">{new Date(tx.ts).toLocaleDateString(lang, { day: "numeric", month: "short" })}, {labels[tx.category] ?? tx.category}</p>
                </div>
                <span className={`tabular shrink-0 font-semibold ${tx.amount < 0 ? "" : "text-ok"}`}>
                  {tx.amount > 0 ? "+" : ""}{formatMoney(tx.currency, tx.amount, lang)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

const DECISION_STYLE: Record<AuditDecision, string> = {
  read: "bg-surface-2 text-muted",
  auto_executed: "bg-ok-soft text-ok",
  approved: "bg-ok-soft text-ok",
  pending_confirmation: "bg-brand-soft text-brand",
  rejected: "bg-surface-2 text-text",
  expired: "bg-surface-2 text-muted",
  blocked: "bg-bad text-white",
  flagged: "bg-bad text-white",
  proposed: "bg-brand-soft text-brand",
  passed: "bg-ok-soft text-ok",
  executed: "bg-ok-soft text-ok",
  refused: "bg-bad-soft text-bad",
  scheduled: "bg-warn-soft text-warn",
};

type LogFilter = "money" | "blocked" | "settings" | "all";

// Everything on the path from a document or request to money moving (or being stopped).
const MONEY_ACTIONS = /(transfer|convert|add_payee)$|^check_|^await_approval$|^read_document$|^security_concern$/;

function matches(e: AuditEntry, f: LogFilter): boolean {
  switch (f) {
    case "all": return true;
    case "blocked": return e.decision === "blocked" || e.decision === "flagged" || e.decision === "refused";
    case "money": return MONEY_ACTIONS.test(e.action);
    case "settings": return ["update_settings", "change_limit", "set_budget", "checklist_progress", "mark_guide_step"].includes(e.action);
  }
}

export function ActivityPanel({ state, lang, d }: { state: LedgerState; lang: Lang; d: Dict }) {
  const [filter, setFilter] = useState<LogFilter>("money");
  const exportLog = () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), sessionId: state.sessionId, profile: state.profile, settings: state.settings, audit: state.audit, transactions: state.transactions }, null, 2)],
      { type: "application/json" },
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `go2china-audit-${state.sessionId}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const actor = { agent: d.agent, user: d.you, system: d.system, policy: d.policyEngine };
  const rows = state.audit.filter((e) => matches(e, filter));
  const blockedCount = state.audit.filter((e) => matches(e, "blocked")).length;
  const groups = new Map<string, AuditEntry[]>();
  for (const e of rows) {
    const day = new Date(e.ts).toLocaleDateString(lang, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }
  const chip = (on: boolean) => `shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface"}`;

  return (
    <div>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.auditLog}</h1>
          <p className="mt-1 text-muted">{d.auditHint}</p>
        </div>
        <button onClick={exportLog} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:border-brand">
          <Download aria-hidden className="h-4 w-4" />{d.exportEvidence}
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["money", "blocked", "settings", "all"] as LogFilter[]).map((f) => (
            <button key={f} className={chip(filter === f)} onClick={() => setFilter(f)}>
              {d.filters[f]}{f === "blocked" && blockedCount > 0 && <span className="tabular ml-1.5 text-bad">{blockedCount}</span>}
            </button>
          ))}
        </div>
        <div className="hidden flex-wrap gap-1.5 md:flex">
          {(["L0", "L1", "L2", "L3"] as Tier[]).map((t) => <TierBadge key={t} tier={t} d={d} />)}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
        {rows.length === 0 && <p className="px-5 py-8 text-center text-muted">{d.emptyLog}</p>}
        {[...groups.entries()].map(([day, entries]) => (
          <div key={day}>
            <p className="border-b border-border bg-surface-2 px-5 py-2 text-sm font-semibold text-muted">{day}</p>
            <ul className="divide-y divide-border">
              {entries.map((e) => {
                const red = e.decision === "blocked" || e.decision === "flagged" || e.decision === "refused";
                return (
                  <li key={e.id} className={`grid grid-cols-[3.5rem_minmax(0,1fr)] gap-x-3 gap-y-2 px-5 py-3.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto] ${red ? "bg-bad-soft/50" : ""}`}>
                    <span className="tabular font-mono text-xs leading-5 text-muted">
                      {new Date(e.ts).toLocaleDateString(lang, { day: "numeric", month: "short" })}
                      <br />
                      {new Date(e.ts).toLocaleTimeString(lang, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <div className="min-w-0">
                      <p><b>{actor[e.actor]}</b> <span className="font-mono text-sm">{e.action}</span></p>
                      {e.detail && <p className="mt-0.5 break-words text-sm text-muted">{e.detail}</p>}
                    </div>
                    <div className="col-start-2 flex flex-wrap items-start gap-1.5 sm:col-start-3 sm:justify-end">
                      <TierBadge tier={e.tier} d={d} />
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${DECISION_STYLE[e.decision]}`}>{d.decisions[e.decision]}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export type SaveResult = { ok: true } | { ok: false; code?: string; message?: string };

const LIMIT_LABEL = (d: Dict): Record<LimitKey, string> => ({ perTxnLimitUsd: d.perTxn, dailyLimitUsd: d.daily, autoApproveLimitUsd: d.autoLimit });

export function SettingsPanel({
  state, lang, d, busy, onSave, onLanguage, onReset, onSignOut, phone,
}: {
  state: LedgerState; lang: Lang; d: Dict; busy: boolean;
  onSave: (body: Partial<Settings> & { pin?: string; cancel?: LimitKey }) => Promise<SaveResult>;
  onLanguage: (l: Lang) => void;
  onReset: () => void;
  onSignOut: () => void;
  phone: string;
}) {
  const [s, setS] = useState<Settings>(() => ({ ...state.settings, ...Object.fromEntries(Object.entries(state.scheduledLimits ?? {}).map(([k, v]) => [k, v!.to])) }));
  const [saved, setSaved] = useState(false);
  const [askPin, setAskPin] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const labels = LIMIT_LABEL(d);
  const modes: { id: AgentMode; label: string; desc: string }[] = [
    { id: "advisor", label: d.advisor, desc: d.advisorDesc },
    { id: "copilot", label: d.copilot, desc: d.copilotDesc },
    { id: "autopilot", label: d.autopilot, desc: d.autopilotDesc },
  ];
  // What each limit is heading to: a scheduled increase counts as already requested.
  const target = (k: LimitKey) => state.scheduledLimits?.[k]?.to ?? state.settings[k];
  const changed = LIMIT_KEYS.filter((k) => s[k] !== target(k));
  // Mirrors the server rule (limits.ts needsPin) so we can ask for the PIN up front.
  const raises = changed.some((k) => s[k] > state.settings[k]) || (s.agentMode === "autopilot" && state.settings.agentMode !== "autopilot");
  const dirty = s.agentMode !== state.settings.agentMode || changed.length > 0;

  const submit = async (withPin?: string) => {
    setErr("");
    const limits = Object.fromEntries(changed.map((k) => [k, s[k]]));
    const r = await onSave({ ...(s.agentMode !== state.settings.agentMode ? { agentMode: s.agentMode } : {}), ...limits, pin: withPin });
    if (r.ok) {
      setAskPin(false);
      setPin("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else if (r.code === "pin_required") setAskPin(true);
    else setErr(r.message ?? d.errorGeneric);
  };

  const num = (k: LimitKey) => (
    <label key={k} className="block text-sm font-medium text-muted">
      {labels[k]}
      <input
        type="number" min={0} max={HARD_MAX[k]} value={s[k]}
        onChange={(e) => { setSaved(false); setS({ ...s, [k]: Math.max(0, Math.min(HARD_MAX[k], Number(e.target.value) || 0)) }); }}
        className="tabular mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-text"
      />
      <span className="mt-1 block text-xs">{fmt(d.maxHint, { x: `$${HARD_MAX[k].toLocaleString("en")}` })}</span>
    </label>
  );
  const scheduled = LIMIT_KEYS.flatMap((k) => (state.scheduledLimits?.[k] ? [[k, state.scheduledLimits[k]!] as const] : []));
  const home = getCountry(state.profile.homeCountry);
  const dest = getCountry(state.profile.destCountry);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{d.settings}</h1>
      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">{d.agentMode}</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => { setSaved(false); setS({ ...s, agentMode: m.id }); }}
              className={`rounded-xl border-2 p-3 text-left ${s.agentMode === m.id ? "border-brand bg-brand-soft" : "border-border bg-surface"}`}
            >
              <p className="font-bold">{m.label}</p>
              <p className="text-sm text-muted">{m.desc}</p>
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-lg font-bold">{d.limitsTitle}</h2>
        <p className="mt-1 text-sm text-muted">{d.limitsNote}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">{LIMIT_KEYS.map(num)}</div>

        {scheduled.length > 0 && (
          <div className="mt-4 rounded-xl bg-warn-soft p-3">
            <p className="text-sm font-semibold text-warn">{d.scheduledTitle}</p>
            <ul className="mt-1.5 space-y-1.5">
              {scheduled.map(([k, v]) => (
                <li key={k} className="tabular flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>
                    {labels[k]}: ${state.settings[k].toLocaleString("en")} → <b>${v.to.toLocaleString("en")}</b>
                    <span className="ml-2 text-muted">{fmt(d.takesEffect, { date: new Date(v.effectiveAt).toLocaleString(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) })}</span>
                  </span>
                  <button disabled={busy} onClick={async () => { if ((await onSave({ cancel: k })).ok) setS((prev) => ({ ...prev, [k]: state.settings[k] })); }} className="rounded-lg border border-border bg-surface px-3 py-1 text-sm font-semibold">{d.cancelChange}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {askPin ? (
          <form
            className="mt-4 rounded-xl border border-brand/30 bg-brand-soft p-4"
            onSubmit={(e) => { e.preventDefault(); submit(pin); }}
          >
            <p className="font-semibold">{d.pinTitle}</p>
            <p className="mt-1 text-sm text-muted">{d.pinNote}</p>
            <p className="tabular mt-2 text-sm">{d.demoPin}: <b className="tracking-[0.2em] text-brand">{DEMO_PIN}</b></p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-muted">
                {d.pinLabel}
                <input
                  type="password" inputMode="numeric" autoComplete="off" autoFocus maxLength={8} value={pin}
                  onChange={(e) => { setPin(e.target.value.replace(/\D/g, "")); setErr(""); }}
                  className="tabular mt-1 block w-32 rounded-lg border border-border bg-surface px-3 py-2 tracking-[0.3em] text-text"
                />
              </label>
              <button disabled={busy || pin.length < 4} className="rounded-lg bg-ink px-5 py-2.5 font-semibold text-on-ink disabled:opacity-50">{d.confirm}</button>
              <button type="button" onClick={() => { setAskPin(false); setPin(""); setErr(""); }} className="rounded-lg border border-border bg-surface px-4 py-2.5 font-semibold">{d.cancel}</button>
            </div>
          </form>
        ) : (
          <button
            disabled={busy || !dirty}
            onClick={() => (raises ? setAskPin(true) : submit())}
            className="mt-4 rounded-lg bg-ink px-5 py-2.5 font-semibold text-on-ink disabled:opacity-50"
          >
            {saved ? <><Ic icon={Check} className="mr-1" />{d.saved}</> : d.save}
          </button>
        )}
        {err && <p className="mt-2 text-sm text-bad" role="alert">{err}</p>}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">{d.language}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => onLanguage(l.code)}
              className={`rounded-full border px-3 py-1.5 text-sm ${state.profile.language === l.code ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-lg font-bold">{d.account}</h2>
        <p className="mt-2 text-sm text-muted">{fmt(d.signedInAs, { phone })}</p>
        <p className="mt-1 text-sm text-muted">{home.flag} {home.name} → {dest.flag} {dest.name}, {state.profile.university}, {state.profile.studentId}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onSignOut} className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold">
            <LogOut aria-hidden className="h-4 w-4" />{d.signOut}
          </button>
          {!confirmReset && (
            <button onClick={() => setConfirmReset(true)} className="rounded-lg border border-border px-4 py-2 text-sm font-semibold">
              {d.changeRoute} / {d.resetSession}
            </button>
          )}
        </div>
        {confirmReset && (
          <div className="mt-3 rounded-xl bg-warn-soft p-3 text-sm">
            <p className="text-warn">{d.resetConfirm}</p>
            <div className="mt-2 flex gap-2">
              <button onClick={onReset} className="rounded-lg bg-bad px-4 py-2 font-semibold text-white">{d.resetSession}</button>
              <button onClick={() => setConfirmReset(false)} className="rounded-lg border border-border px-4 py-2 font-semibold">{d.cancel}</button>
            </div>
          </div>
        )}
      </section>
      <p className="text-xs text-muted">{d.sandboxNote}</p>
    </div>
  );
}

/**
 * Home "To do": at most three money items the assistant noticed, each opening
 * the normal flow (approval card, tuition payment, or a conversion proposal).
 */
export function TodoCard({
  state, lang, d, onOpenWallet, onPayTuition, onAsk,
}: { state: LedgerState; lang: Lang; d: Dict; onOpenWallet: () => void; onPayTuition: () => void; onAsk: (text: string) => void }) {
  const items: { key: string; title: string; sub?: string; tone: "brand" | "warn"; onClick: () => void }[] = [];
  if (state.pending.length) {
    items.push({ key: "pending", title: fmt(d.todoPending, { n: state.pending.length }), tone: "warn", onClick: onOpenWallet });
  }
  const tuitionPaid = state.transactions.some((t) => t.category === "tuition")
    || state.pending.some((p) => p.action.kind === "transfer" && p.action.params.purpose === "tuition");
  if (!tuitionPaid) {
    const hc = getCountry(state.profile.homeCountry).currency;
    const dc = getCountry(state.profile.destCountry).currency;
    const { amount } = invoiceAmount(state);
    const due = new Date(Date.parse(state.createdAt) + 21 * 86_400_000);
    const saving = savingVsWire(compareRoutes(hc, dc, amount, "tuition"));
    items.push({
      key: "tuition", tone: "brand", onClick: onPayTuition,
      title: fmt(d.todoTuition, { amount: formatMoney(dc, amount, lang), date: due.toLocaleDateString(lang, { day: "numeric", month: "short" }) }),
      sub: saving > 0 ? fmt(d.todoTuitionSub, { x: formatMoney(hc, saving, lang) }) : undefined,
    });
  }
  const t = topUpSuggestion(state);
  if (t.homeAmt > 0 && t.runwayDays < 21) {
    items.push({
      key: "runway", tone: "warn",
      title: fmt(d.todoRunway, { cur: t.dc, n: t.runwayDays }),
      sub: fmt(d.convertTitle, { from: formatMoney(t.hc, t.homeAmt, lang), to: formatMoney(t.dc, t.receive, lang) }),
      onClick: () => onAsk(fmt(d.convertPrompt, { from: formatMoney(t.hc, t.homeAmt, lang), to: t.dc })),
    });
  }
  if (!items.length) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface">
      <h2 className="px-5 pb-2 pt-4 font-bold">{d.todoTitle}</h2>
      <ul className="divide-y divide-border border-t border-border">
        {items.slice(0, 3).map((it) => (
          <li key={it.key} className="flex items-center gap-3 px-5 py-3">
            <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${it.tone === "warn" ? "bg-warn" : "bg-brand"}`} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{it.title}</p>
              {it.sub && <p className="tabular text-sm text-muted">{it.sub}</p>}
            </div>
            <button onClick={it.onClick} className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-sm font-semibold text-on-ink">{d.review}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}
