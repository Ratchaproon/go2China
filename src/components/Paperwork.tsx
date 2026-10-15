"use client";
import { getCountry } from "@/lib/countries";
import type { Dict } from "@/lib/i18n";
import { type LedgerState, paperworkProfile } from "@/lib/ledger";
import { STAGES, type PaperStep, type Stage, stepsFor } from "@/lib/paperwork";
import { ExtLink } from "./Markdown";

const KIND_ICON: Record<PaperStep["kind"], string> = {
  immigration: "🛂", university: "🎓", health: "🩺", registration: "🏠", insurance: "🛡️", money: "💱",
};

export const STAY_MONTHS = [5, 11, 48] as const;

function StepRow({
  s, done, d, busy, lang, onToggle, onExplain,
}: { s: PaperStep; done: boolean; d: Dict; busy: boolean; lang: string; onToggle: (id: string, done: boolean) => void; onExplain: (s: PaperStep) => void }) {
  return (
    <div className={`rounded-2xl border p-4 ${done ? "border-ok bg-ok-soft/40" : "border-border bg-surface"}`}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          disabled={busy}
          onChange={(e) => onToggle(s.id, e.target.checked)}
          aria-label={d.markDone}
          className="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]"
        />
        <div className="min-w-0 flex-1">
          <p className={`font-semibold ${done ? "line-through opacity-70" : ""}`}>{KIND_ICON[s.kind]} {s.title}</p>
          <p className="mt-1 text-sm">{s.what}</p>
          <p className="mt-2 text-xs text-muted">
            {d.issuedBy}: {s.issuer}{s.when && <> · {d.when}: <b className="text-text">{s.when}</b></>}
          </p>
          {s.documents && (
            <div className="mt-2 text-sm">
              <p className="text-xs font-semibold text-muted">{d.needDocs}</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{s.documents.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          )}
          <div className="mt-2 space-y-1 text-sm">
            {s.links.length > 0
              ? s.links.map((l) => <div key={l.url}><ExtLink href={l.url}>{l.label}</ExtLink></div>)
              : s.kind === "university" && <p className="text-xs text-muted">{d.noOfficialLink}</p>}
          </div>
          <button onClick={() => onExplain(s)} className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold" lang={lang}>
            💬 {d.askAgent}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PaperworkPanel({
  state, d, busy, onToggle, onExplain,
}: { state: LedgerState; d: Dict; busy: boolean; onToggle: (id: string, done: boolean) => void; onExplain: (s: PaperStep) => void }) {
  const prof = paperworkProfile(state);
  const steps = stepsFor(prof);
  const done = state.paperwork ?? {};
  const count = steps.filter((s) => done[s.id]).length;
  const dest = getCountry(prof.destCountry);
  const stayIdx = STAY_MONTHS.findIndex((m) => m === prof.stayMonths);
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-border bg-surface p-5">
        <p className="text-lg font-bold">{dest.flag} {d.paperwork} · {dest.name}</p>
        <p className="mt-1 text-sm text-muted">
          {prof.studentType === "exchange" ? d.exchange : d.degree} · {stayIdx >= 0 ? d.stayOptions[stayIdx] : `${prof.stayMonths} mo`}
        </p>
        <p className="mt-3 text-sm">{d.paperworkIntro}</p>
        {d.englishOnly && <p className="mt-2 text-xs text-muted">{d.englishOnly}</p>}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="brand-gradient h-full" style={{ width: `${steps.length ? (count / steps.length) * 100 : 0}%` }} />
        </div>
        <p className="tabular mt-1 text-xs text-muted">{count}/{steps.length} {d.progress}</p>
      </section>
      {STAGES.map((stage: Stage) => {
        const list = steps.filter((s) => s.stage === stage);
        if (!list.length) return null;
        return (
          <section key={stage} className="space-y-2">
            <h2 className="font-bold">{d.stages[stage]}</h2>
            {list.map((s) => (
              <StepRow key={s.id} s={s} done={!!done[s.id]} d={d} busy={busy} lang={state.profile.language} onToggle={onToggle} onExplain={onExplain} />
            ))}
          </section>
        );
      })}
    </div>
  );
}

/** Compact checklist card shown in chat when the agent looks up paperwork. */
export function PaperworkCard({ state, stage, d, onOpen }: { state: LedgerState; stage: string; d: Dict; onOpen: () => void }) {
  const steps = stepsFor(paperworkProfile(state)).filter((s) => stage === "all" || s.stage === stage);
  const done = state.paperwork ?? {};
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{d.paperworkCard}</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {steps.slice(0, 8).map((s) => (
          <li key={s.id} className={done[s.id] ? "text-muted line-through" : ""}>
            {done[s.id] ? "✅" : "⬜"} {KIND_ICON[s.kind]} {s.title}
          </li>
        ))}
      </ul>
      <button onClick={onOpen} className="mt-3 rounded-xl border border-brand px-3 py-1.5 text-sm font-semibold text-brand">{d.openPaperwork} →</button>
    </div>
  );
}
