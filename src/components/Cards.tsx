"use client";
import { formatMoney, type CurrencyCode } from "@/lib/countries";
import { Check, CircleCheck, OctagonX, ShieldAlert } from "lucide-react";
import { Ic } from "./icons";
import { CATEGORY_LABELS, type Dict } from "@/lib/i18n";
import type { Lang, LedgerState, PendingAction, RiskLevel } from "@/lib/ledger";
import type { UiCard } from "@/lib/tools";
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

export function PendingCard({
  p, d, busy, onDecide,
}: { p: PendingAction; d: Dict; busy: boolean; onDecide: (id: string, approve: boolean) => void }) {
  const mins = Math.max(0, Math.round((Date.parse(p.expiresAt) - Date.now()) / 60_000));
  return (
    // Styled as a boarding pass: details above the perforation, the decision stub below.
    <div className={`overflow-hidden rounded-2xl border bg-surface ${p.risk === "high" ? "border-bad" : "border-border"}`}>
      <div className={`flex flex-wrap items-center gap-2 px-4 py-2.5 ${p.risk === "high" ? "bg-bad-soft" : "bg-brand-soft"}`}>
        <span className={`text-sm font-semibold ${p.risk === "high" ? "text-bad" : "text-brand"}`}>{d.pendingTitle}</span>
        <span className="ml-auto text-xs text-muted">{d.tiers[p.tier]}</span>
        <RiskBadge risk={p.risk} d={d} />
      </div>
      <div className="px-4 pb-4 pt-3">
        <p className="text-[15px] font-semibold leading-snug">{p.summary}</p>
        {p.agentReason && <p className="mt-1 text-sm text-muted">{p.agentReason}</p>}
        {p.riskReasons.length > 0 && (
          <ul className="mt-3 space-y-1.5 text-sm">
            {p.riskReasons.map((r, i) => (
              <li key={i} className={`border-l-2 pl-3 ${p.risk === "high" ? "border-bad" : "border-warn"}`}>{r}</li>
            ))}
          </ul>
        )}
      </div>
      <div className="perforation mx-4" />
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          disabled={busy}
          onClick={() => onDecide(p.id, true)}
          className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-on-accent disabled:opacity-50"
        >
          {d.approve}
        </button>
        <button
          disabled={busy}
          onClick={() => onDecide(p.id, false)}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-muted hover:text-text disabled:opacity-50"
        >
          {d.reject}
        </button>
        <span className="tabular ml-auto text-xs text-muted">{d.expiresIn} {mins} {d.min}</span>
      </div>
    </div>
  );
}

export function CardView({
  card, state, lang, d, busy, onDecide, onOpenGuide, onOpenPlaces,
}: {
  card: UiCard; state: LedgerState; lang: Lang; d: Dict; busy: boolean;
  onDecide: (id: string, approve: boolean) => void; onOpenGuide: () => void; onOpenPlaces: () => void;
}) {
  switch (card.type) {
    case "places":
      return <PlacesCard state={state} lang={lang} d={d} ids={card.data.ids} onOpen={onOpenPlaces} />;
    case "checklist":
      return <GuideCard state={state} stage={card.data.stage} topic={card.data.topic} d={d} onOpen={onOpenGuide} />;
    case "pending": {
      const p = state.pending.find((x) => x.id === card.data.id);
      if (!p) return null; // already decided or expired; the outcome shows in the chat
      return <PendingCard p={p} d={d} busy={busy} onDecide={onDecide} />;
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
      const { options, source } = card.data;
      const best = options.find((o) => o.eligible);
      return (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold text-muted">
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
                  {o === best && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">{d.best}</span>}
                  {o.experimental && <span className="rounded-full bg-warn-soft px-2 py-0.5 text-xs text-warn">{d.experimental}</span>}
                  {!o.eligible && <span className="text-xs text-muted">{d.notEligible}: {o.ineligibleReason}</span>}
                </div>
                <div className="tabular mt-1.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                  <span className="text-base font-semibold">{formatMoney(source as CurrencyCode, o.totalCost, lang)}</span>
                  <span className="text-xs text-muted">
                    {d.fees} {formatMoney(source as CurrencyCode, o.feeTotal, lang)} ({o.effectiveCostPct}%), {d.eta.toLowerCase()} {eta(o.etaHours, d)}
                  </span>
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
