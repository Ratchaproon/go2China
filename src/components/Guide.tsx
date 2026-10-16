"use client";
import { useState } from "react";
import { Circle, CircleCheck, MessageCircle } from "lucide-react";
import { Ic, TOPIC_ICON } from "./icons";
import { getCountry } from "@/lib/countries";
import { STAGES, TOPICS, type GuideStep, type Stage, type Topic, stepsFor } from "@/lib/guide";
import type { Dict } from "@/lib/i18n";
import { type LedgerState, guideProfile } from "@/lib/ledger";
import { ExtLink } from "./Markdown";

export const STAY_MONTHS = [5, 11, 48] as const;

function StepRow({
  s, done, d, busy, lang, onToggle, onExplain,
}: { s: GuideStep; done: boolean; d: Dict; busy: boolean; lang: string; onToggle: (id: string, done: boolean) => void; onExplain: (s: GuideStep) => void }) {
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
          <p className={`flex items-start gap-2 font-semibold ${done ? "line-through opacity-70" : ""}`}><Ic icon={TOPIC_ICON[s.topic]} className="mt-0.5 text-brand" /><span>{s.title}</span></p>
          <p className="mt-1 text-sm">{s.what}</p>
          <p className="mt-2 text-xs text-muted">
            {d.topics[s.topic]} · {d.issuedBy}: {s.issuer}{s.when && <> · {d.when}: <b className="text-text">{s.when}</b></>}
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
              : s.topic === "academics" && <p className="text-xs text-muted">{d.noOfficialLink}</p>}
          </div>
          <button onClick={() => onExplain(s)} className="mt-3 rounded-full border border-border px-3 py-1 text-xs font-semibold" lang={lang}>
            <Ic icon={MessageCircle} className="mr-1" />{d.askAgent}
          </button>
        </div>
      </div>
    </div>
  );
}

export function GuidePanel({
  state, d, busy, onToggle, onExplain,
}: { state: LedgerState; d: Dict; busy: boolean; onToggle: (id: string, done: boolean) => void; onExplain: (s: GuideStep) => void }) {
  const [topic, setTopic] = useState<Topic | "all">("all");
  const prof = guideProfile(state);
  const all = stepsFor(prof);
  const steps = all.filter((s) => topic === "all" || s.topic === topic);
  const done = state.checklist ?? {};
  const count = all.filter((s) => done[s.id]).length;
  const dest = getCountry(prof.destCountry);
  const stayIdx = STAY_MONTHS.findIndex((m) => m === prof.stayMonths);
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border"}`;
  const topicsHere = TOPICS.filter((t) => all.some((s) => s.topic === t));
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-lg font-bold">{dest.flag} {d.checklistTitle} · {dest.name}</p>
        <p className="mt-1 text-sm text-muted">
          {prof.studentType === "exchange" ? d.exchange : d.degree} · {stayIdx >= 0 ? d.stayOptions[stayIdx] : `${prof.stayMonths} mo`}
        </p>
        <p className="mt-3 text-sm">{d.guideIntro}</p>
        {d.englishOnly && <p className="mt-2 text-xs text-muted">{d.englishOnly}</p>}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full bg-brand" style={{ width: `${all.length ? (count / all.length) * 100 : 0}%` }} />
        </div>
        <p className="tabular mt-1 text-xs text-muted">{count}/{all.length} {d.progress}</p>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button className={chip(topic === "all")} onClick={() => setTopic("all")}>{d.allTopics}</button>
        {topicsHere.map((t) => {
          const n = all.filter((s) => s.topic === t);
          const doneN = n.filter((s) => done[s.id]).length;
          return (
            <button key={t} className={chip(topic === t)} onClick={() => setTopic(t)}>
              <Ic icon={TOPIC_ICON[t]} className="mr-1" />{d.topics[t]} <span className="tabular text-xs text-muted">{doneN}/{n.length}</span>
            </button>
          );
        })}
      </div>
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

/** Compact checklist card shown in chat when the agent looks up the guide. */
export function GuideCard({
  state, stage, topic, d, onOpen,
}: { state: LedgerState; stage: string; topic: string; d: Dict; onOpen: () => void }) {
  const steps = stepsFor(guideProfile(state)).filter((s) => (stage === "all" || s.stage === stage) && (topic === "all" || s.topic === topic));
  const done = state.checklist ?? {};
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-sm font-semibold text-muted">
        {d.guideCard}{topic !== "all" && ` · ${d.topics[topic as Topic] ?? topic}`}
      </p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {steps.slice(0, 8).map((s) => (
          <li key={s.id} className={done[s.id] ? "text-muted line-through" : ""}>
            <Ic icon={done[s.id] ? CircleCheck : Circle} className={`mr-1.5 ${done[s.id] ? "text-ok" : "text-muted"}`} />
            {s.title}
          </li>
        ))}
      </ul>
      {steps.length > 8 && <p className="mt-1 text-xs text-muted">+{steps.length - 8}</p>}
      <button onClick={onOpen} className="mt-3 rounded-xl border border-brand px-3 py-1.5 text-sm font-semibold text-brand">{d.guide}</button>
    </div>
  );
}
