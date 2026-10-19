"use client";
import { formatMoney, type CurrencyCode } from "@/lib/countries";
import { Check, CircleCheck, Clock, OctagonX, ShieldAlert, TriangleAlert } from "lucide-react";
import { Ic } from "./icons";
import { CATEGORY_LABELS, type Dict, fmt } from "@/lib/i18n";
import type { Lang, LedgerState, PendingAction, RiskLevel } from "@/lib/ledger";
import type { UiCard } from "@/lib/tools";
import { getRoute, priceRoute, savingVsWire } from "@/lib/routes";
import type { ToolTraceEntry } from "@/lib/agent";
import type { AgentStep, StepStatus } from "@/lib/steps";
import { GuideCard } from "./Guide";
import { PlacesCard } from "./Places";

const riskStyle: Record<RiskLevel, string> = {
  low: "bg-ok-soft text-ok",
  medium: "bg-warn-soft text-warn",
  high: "bg-bad-soft text-bad",
};

export function RiskBadge({ risk, d }: { risk: RiskLevel; d: Dict }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskStyle[risk]}`}>
      {d.risk}: {d.riskLevel[risk]}
    </span>
  );
}

function eta(h: [number, number], d: Dict) {
  if (h[1] === 0) return d.instant;
  return `${h[0]}–${h[1]} ${d.hours}`;
}

function PendingChecks({ p, state, d }: { p: PendingAction; state: LedgerState; d: Dict }) {
  const a = p.action;
  const payee = a.kind === "transfer" ? state.payees.find((x) => x.id === a.params.payeeId) : undefined;
  const recentFlag = state.audit.some((e) => e.decision === "flagged" && Date.now() - Date.parse(e.ts) < 30 * 60_000);
  const checks: [boolean, string][] = [];
  if (payee) checks.push([payee.verified, d.checks.payee]);
  if (a.kind !== "add_payee") checks.push([true, d.checks.limits]);
  if (payee) checks.push([state.transactions.some((t) => t.counterparty === payee.name && t.amount < 0), d.checks.paidBefore]);
  checks.push([!recentFlag, d.checks.noInjection]);
  const passed = checks.filter(([ok]) => ok);
  if (!passed.length) return null;
  return (
    <div className="mt-4">
      <p className="text-sm font-semibold text-muted">{d.checksPassed}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {passed.map(([, label]) => (
          <li key={label} className="rounded-full bg-ok-soft px-3 py-1 text-sm font-medium text-ok"><Ic icon={Check} className="mr-1" />{label}</li>
        ))}
      </ul>
    </div>
  );
}

export function PendingCard({
  p, state, lang, d, busy, onDecide, onAsk,
}: {
  p: PendingAction; state: LedgerState; lang: Lang; d: Dict; busy: boolean;
  onDecide: (id: string, approve: boolean) => void; onAsk: (text: string) => void;
}) {
  const mins = Math.max(0, Math.round((Date.parse(p.expiresAt) - Date.now()) / 60_000));
  const a = p.action;
  const high = p.risk === "high";
  const box = "min-w-0 rounded-xl bg-surface-2 px-4 py-3";

  let headline: React.ReactNode = p.summary;
  let sub: React.ReactNode = null;
  let saved = "";
  let from: React.ReactNode = null;
  let to: React.ReactNode = null;
  if (a.kind === "transfer") {
    const t = a.params;
    const src = state.accounts.find((x) => x.currency === t.sourceCurrency);
    const payee = state.payees.find((x) => x.id === t.payeeId);
    headline = formatMoney(t.receiveCurrency, t.receiveAmount, lang);
    sub = fmt(d.includingFee, { x: formatMoney(t.sourceCurrency, t.totalCost, lang), fee: formatMoney(t.sourceCurrency, t.feeTotal, lang) });
    const wire = getRoute("swift_wire");
    if (wire && t.routeId !== wire.id) {
      const wireCost = priceRoute(wire, t.sourceCurrency, t.receiveCurrency, t.receiveAmount, t.purpose).totalCost;
      if (wireCost > t.totalCost) saved = fmt(d.savesVsWire, { x: formatMoney(t.sourceCurrency, wireCost - t.totalCost, lang) });
    }
    from = (
      <>
        <p className="font-semibold">{src?.label ?? t.sourceCurrency}</p>
        {src && <p className="tabular text-sm text-muted">{fmt(d.balanceAfter, { x: formatMoney(src.currency, src.balance - t.totalCost, lang) })}</p>}
      </>
    );
    to = (
      <>
        <p className="font-semibold">{payee?.name ?? t.payeeId} {payee?.verified && <span className="ml-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-semibold text-ok">{d.verified}</span>}</p>
        {payee && <p className="text-sm text-muted">{payee.bankName}, ••••{payee.accountNumber.slice(-4)}</p>}
      </>
    );
  } else if (a.kind === "convert") {
    const c = a.params;
    const src = state.accounts.find((x) => x.currency === c.fromCurrency);
    const dst = state.accounts.find((x) => x.currency === c.toCurrency);
    headline = formatMoney(c.toCurrency, c.receive, lang);
    sub = `≈ ${formatMoney(c.fromCurrency, c.amount, lang)}`;
    from = (
      <>
        <p className="font-semibold">{src?.label ?? c.fromCurrency}</p>
        {src && <p className="tabular text-sm text-muted">{fmt(d.balanceAfter, { x: formatMoney(src.currency, src.balance - c.amount, lang) })}</p>}
      </>
    );
    to = <p className="font-semibold">{dst?.label ?? `${c.toCurrency} wallet`}</p>;
  }

  return (
    <div className={`rounded-2xl border-2 bg-surface p-5 ${high ? "border-bad" : "border-brand"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="text-sm font-semibold text-muted">{d.pendingTitle}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${high ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
          {d.tiers[p.tier]}{p.risk !== "low" && <>, {d.risk.toLowerCase()} {d.riskLevel[p.risk].toLowerCase()}</>}
        </span>
      </div>
      <p className={`tabular mt-1 font-bold tracking-tight ${a.kind === "add_payee" ? "text-xl" : "text-3xl sm:text-4xl"}`}>{headline}</p>
      {sub && <p className="tabular mt-1 text-muted">{sub}</p>}
      {saved && <p className="tabular mt-1 text-sm font-semibold text-ok"><Ic icon={Check} className="mr-1" />{saved}</p>}
      {from && to && (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <div className={box}><p className="text-xs font-semibold text-muted">{d.fromLabel}</p>{from}</div>
          <div className={box}><p className="text-xs font-semibold text-muted">{d.toLabel}</p>{to}</div>
        </div>
      )}
      {p.agentReason && <p className="mt-3 text-sm text-muted">{p.agentReason}</p>}
      {p.riskReasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-sm">
          {p.riskReasons.map((r, i) => (
            <li key={i} className={`flex gap-2 rounded-lg px-3 py-2 ${high ? "bg-bad-soft" : "bg-warn-soft"}`}>
              <Ic icon={TriangleAlert} className={`mt-0.5 ${high ? "text-bad" : "text-warn"}`} /><span>{r}</span>
            </li>
          ))}
        </ul>
      )}
      <PendingChecks p={p} state={state} d={d} />
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button
          disabled={busy}
          onClick={() => onDecide(p.id, true)}
          className="rounded-xl bg-ink px-6 py-3 font-bold text-on-ink disabled:opacity-50"
        >
          {a.kind === "transfer" ? d.approveAndPay : d.approveAction}
        </button>
        <button
          disabled={busy}
          onClick={() => onDecide(p.id, false)}
          className="rounded-xl border border-border bg-surface px-5 py-3 font-semibold disabled:opacity-50"
        >
          {d.reject}
        </button>
        <button disabled={busy} onClick={() => onAsk(`${d.askFirstPrompt} ${p.summary}`)} className="px-2 py-3 font-semibold text-brand disabled:opacity-50">
          {d.askFirst}
        </button>
      </div>
      <p className="mt-4 text-xs text-muted">
        {d.approvalFooter} <span className="tabular whitespace-nowrap">{d.expiresIn} {mins} {d.min}.</span>
      </p>
    </div>
  );
}

export function CardView({
  card, state, lang, d, busy, onDecide, onOpenGuide, onOpenPlaces, onAsk,
}: {
  card: UiCard; state: LedgerState; lang: Lang; d: Dict; busy: boolean;
  onDecide: (id: string, approve: boolean) => void; onOpenGuide: () => void; onOpenPlaces: () => void; onAsk: (text: string) => void;
}) {
  switch (card.type) {
    case "places":
      return <PlacesCard state={state} lang={lang} d={d} ids={card.data.ids} onOpen={onOpenPlaces} />;
    case "checklist":
      return <GuideCard state={state} stage={card.data.stage} topic={card.data.topic} d={d} onOpen={onOpenGuide} />;
    case "pending": {
      const p = state.pending.find((x) => x.id === card.data.id);
      if (!p) return null; // already decided or expired; the outcome shows in the chat
      return <PendingCard p={p} state={state} lang={lang} d={d} busy={busy} onDecide={onDecide} onAsk={onAsk} />;
    }
    case "blocked":
      return (
        <div className="rounded-2xl border border-bad bg-bad-soft p-4 text-sm">
          <p className="font-semibold text-bad"><Ic icon={OctagonX} className="mr-1.5" />{d.blockedTitle}</p>
          <p className="mt-1 font-medium">{card.data.summary}</p>
          <ul className="mt-2 space-y-1">{card.data.reasons.map((r, i) => <li key={i}>• {r}</li>)}</ul>
        </div>
      );
    case "executed":
      return (
        <div className="rounded-2xl border border-ok bg-ok-soft p-3 text-sm">
          <span className="font-semibold text-ok"><Ic icon={CircleCheck} className="mr-1.5" />{d.executedTitle}:</span> {card.data.summary}
        </div>
      );
    case "security":
      return (
        <div className="rounded-2xl border border-bad bg-bad-soft p-3 text-sm">
          <p className="font-semibold text-bad"><Ic icon={ShieldAlert} className="mr-1.5" />{d.securityTitle}</p>
          <p className="mt-1">{card.data.description}</p>
        </div>
      );
    case "fx": {
      const q = card.data;
      const trend = q.trend === "better_than_usual" ? d.better : q.trend === "worse_than_usual" ? d.worse : d.normal;
      const color = q.trend === "better_than_usual" ? "text-ok" : q.trend === "worse_than_usual" ? "text-bad" : "text-muted";
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-muted">{d.fxTitle}</p>
          <p className="tabular mt-1 text-lg font-bold">
            {formatMoney(q.from, q.amount, lang)} → {formatMoney(q.to, q.receive, lang)}
          </p>
          <p className="tabular text-sm text-muted">1 {q.from} = {q.rate.toFixed(4)} {q.to}</p>
          <p className={`mt-1 text-sm font-semibold ${color}`}>
            {trend} ({q.vsAvg30Pct > 0 ? "+" : ""}{q.vsAvg30Pct}% {d.vs30d})
          </p>
        </div>
      );
    }
    case "routes": {
      const { options, source, receive, amount } = card.data;
      const best = options.find((o) => o.eligible);
      const cur = source as CurrencyCode;
      const saving = savingVsWire(options);
      const rate = (o: (typeof options)[number]) => ((o.totalCost - o.feeTotal) / amount).toFixed(amount >= 100 ? 2 : 4);
      return (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-lg font-bold">{d.routesTitle}: {formatMoney(receive, amount, lang)}</p>
          {saving > 0 && best && (
            <p className="tabular mt-1 font-semibold text-ok"><Ic icon={Check} className="mr-1" />{best.name}: {fmt(d.savesVsWire, { x: formatMoney(cur, saving, lang) })}</p>
          )}
          {/* Phone: stacked rows. */}
          <ul className="mt-3 space-y-2 sm:hidden">
            {options.map((o) => (
              <li key={o.routeId} className={`rounded-xl border p-3 text-sm ${o === best ? "border-brand bg-brand-soft" : "border-border"} ${o.eligible ? "" : "opacity-55"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.name}</span>
                  {o === best && <span className="rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-on-ink">{d.best}</span>}
                </div>
                {!o.eligible && <p className="text-xs text-muted">{o.ineligibleReason}</p>}
                <div className="tabular mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="text-base font-bold">{formatMoney(cur, o.totalCost, lang)}</span>
                  <span className="text-xs text-muted">{d.fees} {formatMoney(cur, o.feeTotal, lang)}, {eta(o.etaHours, d)}</span>
                </div>
              </li>
            ))}
          </ul>
          {/* Wider screens: a comparison table. */}
          <table className="tabular mt-3 hidden w-full text-left text-[15px] sm:table">
            <thead>
              <tr className="text-xs font-semibold text-muted">
                <th className="px-2.5 py-2 font-semibold">{d.routeCol}</th>
                <th className="px-2.5 py-2 font-semibold">{d.rateCol}</th>
                <th className="px-2.5 py-2 font-semibold">{d.fees}</th>
                <th className="px-2.5 py-2 font-semibold">{d.youPayCol}</th>
                <th className="px-2.5 py-2 font-semibold">{d.eta}</th>
              </tr>
            </thead>
            <tbody>
              {options.map((o) => (
                <tr key={o.routeId} className={`border-t border-border ${o === best ? "bg-brand-soft" : ""} ${o.eligible ? "" : "text-muted"}`}>
                  <td className="rounded-l-lg px-2.5 py-2.5">
                    <span className={o === best ? "font-bold" : ""}>{o.name}</span>
                    {o === best && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-xs font-semibold text-on-ink">{d.best}</span>}
                    {o.experimental && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">{d.experimental}</span>}
                    {!o.eligible && <span className="block text-xs">{o.ineligibleReason}</span>}
                  </td>
                  <td className="px-2.5 py-2.5">{rate(o)}</td>
                  <td className="px-2.5 py-2.5">{formatMoney(cur, o.feeTotal, lang)}</td>
                  <td className={`px-2.5 py-2.5 ${o === best ? "font-bold" : ""}`}>{formatMoney(cur, o.totalCost, lang)}</td>
                  <td className="rounded-r-lg px-2.5 py-2.5">{eta(o.etaHours, d)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted">{d.sandboxRates}. {d.rateCol} = {source} / 1 {receive}.</p>
        </div>
      );
    }
    case "budget": {
      const b = card.data;
      const labels = CATEGORY_LABELS[lang];
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-muted">{d.budgetTitle}</p>
          <div className="mt-2 space-y-2">
            {b.categories.map((c) => {
              const pct = c.pct ?? 0;
              const bar = c.status === "over" ? "bg-bad" : c.status === "warning" ? "bg-warn" : "bg-brand";
              return (
                <div key={c.category} className="text-sm">
                  <div className="tabular flex justify-between">
                    <span>{labels[c.category] ?? c.category}</span>
                    <span className="text-muted">
                      {formatMoney(b.currency, c.spent, lang)}{c.limit != null && <> / {formatMoney(b.currency, c.limit, lang)}</>}
                    </span>
                  </div>
                  {c.limit != null && (
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-sm">{d.runway} <b>{b.runwayMonths}</b> {d.months}</p>
        </div>
      );
    }
    case "guide":
      // Guide items are stored in English; in other languages the agent's reply carries the translated version.
      if (lang !== "en") return null;
      return (
        <div className="rounded-2xl border border-border bg-surface p-4 text-sm">
          <p className="text-sm font-semibold text-muted">{d.guideTitle} · {card.data.country}</p>
          <ul className="mt-2 space-y-1.5">{card.data.items.map((it, i) => <li key={i} className="flex gap-2"><Ic icon={Check} className="mt-0.5 text-ok" /><span>{it}</span></li>)}</ul>
        </div>
      );
  }
}

const STEP_STYLE: Record<StepStatus, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  fail: "bg-bad-soft text-bad",
  wait: "bg-warn-soft text-warn",
};

function StepIcon({ status }: { status: StepStatus }) {
  const cls = "h-3.5 w-3.5";
  return (
    <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${STEP_STYLE[status]}`}>
      {status === "ok" ? <Check aria-hidden className={cls} strokeWidth={2.5} />
        : status === "wait" ? <Clock aria-hidden className={cls} />
          : status === "fail" ? <OctagonX aria-hidden className={cls} />
            : <TriangleAlert aria-hidden className={cls} />}
    </span>
  );
}

/**
 * "What I did": the agent's steps for one reply, streamed live while it works.
 * Step results are worded by code. The final "waiting" step follows the
 * approval's outcome, so it flips to approved, rejected or expired later.
 */
export function StepsCard({
  steps, trace, cards, state, d, live = false,
}: { steps?: AgentStep[]; trace?: ToolTraceEntry[]; cards: UiCard[]; state: LedgerState; d: Dict; live?: boolean }) {
  // Older messages only have the raw tool trace.
  const list: AgentStep[] = steps ?? (trace ?? []).filter((t) => t.name !== "get_overview").map((t) => ({ key: t.name, status: t.isError ? "fail" : "ok" }));
  const pendingId = cards.find((c) => c.type === "pending")?.data;
  const outcome = (): { status: StepStatus; label: string; note?: string } => {
    const id = pendingId && "id" in pendingId ? pendingId.id : undefined;
    if (id && !state.pending.some((p) => p.id === id)) {
      const e = state.audit.find((a) => a.refId === id && ["approved", "rejected", "expired", "blocked"].includes(a.decision));
      if (e?.decision === "approved") return { status: "ok", label: d.decisions.approved };
      if (e) return { status: e.decision === "blocked" ? "fail" : "warn", label: d.decisions[e.decision] };
    }
    return { status: "wait", label: d.stepsWaiting, note: d.stepsWaitingNote };
  };
  if (!list.length && !live) return null;
  return (
    <div className="rounded-2xl border border-border bg-surface px-5 py-4" aria-live="polite">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-bold">{d.stepsTitle}</p>
        {list.length > 0 && <p className="tabular text-xs text-muted">{list.filter((s) => s.key !== "waiting").length}</p>}
      </div>
      <ol className="mt-3 space-y-2.5">
        {list.map((st, i) => {
          if (st.key === "waiting") {
            const o = outcome();
            return (
              <li key={i} className="flex items-start gap-3 text-[15px]">
                <StepIcon status={o.status} />
                <span><b className={o.status === "ok" ? "text-ok" : "text-warn"}>{o.label}</b>{o.note && <span className="block text-sm text-muted">{o.note}</span>}</span>
              </li>
            );
          }
          return (
            <li key={i} className="flex items-start gap-3 text-[15px]">
              <StepIcon status={st.status} />
              <span className="min-w-0">
                <span className={`font-medium ${st.status === "fail" ? "text-bad" : ""}`}>{d.toolSteps[st.key] ?? st.key}</span>
                {st.detail && <span className="block break-words text-sm text-muted">{st.detail}</span>}
              </span>
            </li>
          );
        })}
        {live && (
          <li className="flex items-center gap-3 text-[15px] text-muted">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-brand" />
            </span>
            {d.thinking}
          </li>
        )}
      </ol>
    </div>
  );
}
