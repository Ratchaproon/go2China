"use client";
import { useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import { LANGS, t } from "@/lib/i18n";
import type { Lang } from "@/lib/ledger";
import type { StudentType } from "@/lib/paperwork";
import { STAY_MONTHS } from "./Paperwork";

export interface OnboardingValues {
  name: string;
  homeCountry: string;
  destCountry: string;
  language: Lang;
  university: string;
  studentType: StudentType;
  stayMonths: number;
}

const DESTINATIONS = COUNTRIES.filter((c) => c.guide);

export function Onboarding({
  initial, busy, error, onSubmit,
}: { initial?: Partial<OnboardingValues>; busy: boolean; error: string; onSubmit: (v: OnboardingValues) => void }) {
  const [v, setV] = useState<OnboardingValues>({
    name: "", homeCountry: "TH", destCountry: "CN", language: "en", university: "", studentType: "exchange", stayMonths: 5, ...initial,
  });
  const d = t(v.language);
  const field = "w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base outline-none focus:border-brand";
  const set = <K extends keyof OnboardingValues>(k: K, val: OnboardingValues[K]) => setV((s) => ({ ...s, [k]: val }));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <img src="/icon.svg" alt="" className="h-12 w-12" />
        <div>
          <h1 className="text-2xl font-extrabold">go2China</h1>
          <p className="text-sm text-muted">{d.tagline}</p>
        </div>
      </div>
      <form
        className="space-y-4 rounded-3xl border border-border bg-surface p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(v);
        }}
      >
        <h2 className="text-lg font-bold">{d.welcome}</h2>
        <label className="block text-sm font-medium">
          {d.language}
          <select className={`${field} mt-1`} value={v.language} onChange={(e) => set("language", e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium">
          {d.yourName}
          <input className={`${field} mt-1`} value={v.name} maxLength={60} onChange={(e) => set("name", e.target.value)} />
        </label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="block text-sm font-medium">
            {d.from}
            <select className={`${field} mt-1`} value={v.homeCountry} onChange={(e) => set("homeCountry", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            aria-label="Swap"
            className="mb-1.5 rounded-full border border-border px-2 py-1.5 text-muted"
            onClick={() => setV((s) => ({ ...s, homeCountry: s.destCountry, destCountry: s.homeCountry }))}
          >
            ⇄
          </button>
          <label className="block text-sm font-medium">
            {d.to}
            <select className={`${field} mt-1`} value={v.destCountry} onChange={(e) => set("destCountry", e.target.value)}>
              {(DESTINATIONS.some((c) => c.code === v.destCountry) ? DESTINATIONS : [...DESTINATIONS, COUNTRIES.find((c) => c.code === v.destCountry)!])
                .map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-sm font-medium">
            {d.studentType}
            <select className={`${field} mt-1`} value={v.studentType} onChange={(e) => set("studentType", e.target.value as StudentType)}>
              <option value="exchange">{d.exchange}</option>
              <option value="degree">{d.degree}</option>
            </select>
          </label>
          <label className="block text-sm font-medium">
            {d.stay}
            <select className={`${field} mt-1`} value={v.stayMonths} onChange={(e) => set("stayMonths", Number(e.target.value))}>
              {STAY_MONTHS.map((m, i) => <option key={m} value={m}>{d.stayOptions[i]}</option>)}
            </select>
          </label>
        </div>
        <label className="block text-sm font-medium">
          {d.university}
          <input className={`${field} mt-1`} value={v.university} maxLength={120} placeholder={d.universityPlaceholder} onChange={(e) => set("university", e.target.value)} />
        </label>
        {error && <p className="rounded-xl bg-bad-soft p-3 text-sm text-bad">{error}</p>}
        <button
          disabled={busy || v.homeCountry === v.destCountry}
          className="brand-gradient w-full rounded-xl py-3 text-base font-bold text-white disabled:opacity-50"
        >
          {busy ? d.starting : d.start}
        </button>
        <p className="text-center text-xs text-muted">{d.sandboxNote}</p>
      </form>
    </main>
  );
}
