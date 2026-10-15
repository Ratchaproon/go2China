"use client";
import { formatMoney, type CurrencyCode } from "@/lib/countries";
import { CATEGORY_LABELS, type Dict } from "@/lib/i18n";
import type { Lang, LedgerState, PendingAction, RiskLevel } from "@/lib/ledger";
import type { UiCard } from "@/lib/tools";
import { PaperworkCard } from "./Paperwork";

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

export function PendingCard({
  p, d, busy, onDecide,
}: { p: PendingAction; d: Dict; busy: boolean; onDecide: (id: string, approve: boolean) => void }) {
  const mins = Math.max(0, Math.round((Date.parse(p.expiresAt) - Date.now()) / 60_000));
  return (
    <div className={`rounded-2xl border-2 bg-surface p-4 ${p.risk === "high" ? "border-bad" : "border-brand"}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-brand">{d.pendingTitle}</span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted">{d.tiers[p.tier]}</span>
        <RiskBadge risk={p.risk} d={d} />
      </div>
      <p className="font-medium">{p.summary}</p>
      {p.agentReason && <p className="mt-1 text-sm text-muted">{p.agentReason}</p>}
      {p.riskReasons.length > 0 && (
        <ul className={`mt-3 space-y-1 rounded-xl p-3 text-sm ${p.risk === "high" ? "bg-bad-soft" : "bg-surface-2"}`}>
          {p.riskReasons.map((r, i) => <li key={i}>⚠️ {r}</li>)}
        </ul>
      )}
      <div className="mt-3 flex items-center gap-2">
        <button
          disabled={busy}
          onClick={() => onDecide(p.id, true)}
          className="brand-gradient rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {d.approve}
        </button>
        <button
          disabled={busy}
          onClick={() => onDecide(p.id, false)}
          className="rounded-xl border border-border px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          {d.reject}
        </button>
        <span className="ml-auto text-xs text-muted">{d.expiresIn} {mins} {d.min}</span>
      </div>
    </div>
  );
}

export function CardView({
  card, state, lang, d, busy, onDecide, onOpenPaperwork,
}: {
  card: UiCard; state: LedgerState; lang: Lang; d: Dict; busy: boolean;
  onDecide: (id: string, approve: boolean) => void; onOpenPaperwork: () => void;
}) {
  switch (card.type) {
    case "paperwork":
      return <PaperworkCard state={state} stage={card.data.stage} d={d} onOpen={onOpenPaperwork} />;
    case "pending": {
      const p = state.pending.find((x) => x.id === card.data.id);
      if (!p) return null; // already decided or expired; the outcome shows in the chat
      return <PendingCard p={p} d={d} busy={busy} onDecide={onDecide} />;
    }
    case "blocked":
      return (
        <div className="rounded-2xl border border-bad bg-bad-soft p-4 text-sm">
          <p className="font-bold text-bad">⛔ {d.blockedTitle}</p>
          <p className="mt-1 font-medium">{card.data.summary}</p>
          <ul className="mt-2 space-y-1">{card.data.reasons.map((r, i) => <li key={i}>• {r}</li>)}</ul>
        </div>
      );
    case "executed":
      return (
        <div className="rounded-2xl border border-ok bg-ok-soft p-3 text-sm">
          <span className="font-bold text-ok">✓ {d.executedTitle}:</span> {card.data.summary}
        </div>
      );
    case "security":
      return (
        <div className="rounded-2xl border border-bad bg-bad-soft p-3 text-sm">
          <p className="font-bold text-bad">🛡️ {d.securityTitle}</p>
          <p className="mt-1">{card.data.description}</p>
        </div>
      );
    case "fx": {
      const q = card.data;
      const trend = q.trend === "better_than_usual" ? d.better : q.trend === "worse_than_usual" ? d.worse : d.normal;
      const color = q.trend === "better_than_usual" ? "text-ok" : q.trend === "worse_than_usual" ? "text-bad" : "text-muted";
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.fxTitle}</p>
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
      const { options, source } = card.data;
      const best = options.find((o) => o.eligible);
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {d.routesTitle} · {d.receive} {formatMoney(card.data.receive, card.data.amount, lang)}
          </p>
          <div className="mt-2 space-y-2">
            {options.map((o) => (
              <div
                key={o.routeId}
                className={`rounded-xl border p-3 text-sm ${o === best ? "border-brand bg-brand-soft" : "border-border"} ${o.eligible ? "" : "opacity-55"}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{o.name}</span>
                  {o === best && <span className="brand-gradient rounded-full px-2 py-0.5 text-xs font-semibold text-white">{d.best}</span>}
                  {o.experimental && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">{d.experimental}</span>}
                  {!o.eligible && <span className="text-xs text-muted">{d.notEligible}: {o.ineligibleReason}</span>}
                </div>
                <div className="tabular mt-1 grid grid-cols-3 gap-2 text-xs text-muted">
                  <span>{d.totalCost}<br /><b className="text-sm text-text">{formatMoney(source as CurrencyCode, o.totalCost, lang)}</b></span>
                  <span>{d.fees}<br /><b className="text-sm text-text">{formatMoney(source as CurrencyCode, o.feeTotal, lang)}</b> <span>({o.effectiveCostPct}%)</span></span>
                  <span>{d.eta}<br /><b className="text-sm text-text">{eta(o.etaHours, d)}</b></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    case "budget": {
      const b = card.data;
      const labels = CATEGORY_LABELS[lang];
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.budgetTitle}</p>
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
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.guideTitle} · {card.data.country}</p>
          <ul className="mt-2 space-y-1.5">{card.data.items.map((it, i) => <li key={i}>✓ {it}</li>)}</ul>
        </div>
      );
  }
}
