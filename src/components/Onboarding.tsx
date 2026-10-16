"use client";
import { useState } from "react";
import { ArrowLeftRight } from "lucide-react";
import { COUNTRIES, getCountry } from "@/lib/countries";
import { LANGS, t } from "@/lib/i18n";
import type { Lang } from "@/lib/ledger";
import type { StudentType } from "@/lib/guide";
import { STAY_MONTHS } from "./Guide";

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

const ISO3: Record<string, string> = {
  TH: "THA", CN: "CHN", JP: "JPN", KR: "KOR", SG: "SGP", MY: "MYS", VN: "VNM", ID: "IDN", PH: "PHL", IN: "IND",
  LA: "LAO", KH: "KHM", PK: "PAK", BD: "BGD", HK: "HKG", FR: "FRA", CA: "CAN", NZ: "NZL", BR: "BRA", NG: "NGA",
  GB: "GBR", US: "USA", AU: "AUS", DE: "DEU",
};

/** Two 44-character lines in the style of a passport's machine-readable zone. */
function mrz(v: OnboardingValues): [string, string] {
  const pad = (s: string) => (s + "<".repeat(44)).slice(0, 44);
  const name = v.name.normalize("NFKD").toUpperCase().replace(/[^A-Z ]/g, "").trim().replace(/\s+/g, "<") || "STUDENT";
  const l1 = pad(`P<${ISO3[v.homeCountry] ?? v.homeCountry}${name}`);
  const l2 = pad(`${ISO3[v.destCountry] ?? v.destCountry}<<${v.studentType.toUpperCase()}<<${String(v.stayMonths).padStart(2, "0")}M<<GO2CHINA`);
  return [l1, l2];
}

export function Onboarding({
  initial, busy, error, onSubmit,
}: { initial?: Partial<OnboardingValues>; busy: boolean; error: string; onSubmit: (v: OnboardingValues) => void }) {
  const [v, setV] = useState<OnboardingValues>({
    name: "", homeCountry: "TH", destCountry: "CN", language: "en", university: "", studentType: "exchange", stayMonths: 5, ...initial,
  });
  const d = t(v.language);
  const field = "mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-text outline-none focus:border-brand";
  const label = "block text-sm font-medium text-muted";
  const set = <K extends keyof OnboardingValues>(k: K, val: OnboardingValues[K]) => setV((s) => ({ ...s, [k]: val }));
  const home = getCountry(v.homeCountry);
  const dest = getCountry(v.destCountry);
  const stayIdx = STAY_MONTHS.findIndex((m) => m === v.stayMonths);
  const [l1, l2] = mrz(v);

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl grid-cols-1 items-center gap-8 px-4 py-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] md:gap-12 md:py-16">
      <section className="min-w-0">
        <div className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <span className="text-lg font-semibold tracking-tight">go2China</span>
        </div>
        <h1 className="mt-6 text-3xl font-semibold leading-tight tracking-tight md:text-[2.6rem]">{d.welcome}</h1>
        <p className="mt-3 max-w-md text-muted">{d.tagline}</p>

        {/* Passport data page: fills in live as the student answers. */}
        <div className="mt-6 min-w-0 overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_12px_32px_-16px_rgba(23,37,84,.35)]">
          <div className="flex items-center justify-between bg-[#1d2f6b] px-5 py-3 text-[#f8faff]">
            <span className="text-sm font-semibold">{d.studyPass}</span>
            <span className="text-2xl leading-none" aria-hidden>{dest.flag}</span>
          </div>
          <div
            className="grid grid-cols-2 gap-x-6 gap-y-3 px-5 py-4 text-sm"
            style={{ backgroundImage: "repeating-radial-gradient(circle at 88% 20%, transparent 0 9px, color-mix(in srgb, var(--brand) 7%, transparent) 9px 10px)" }}
          >
            <div className="col-span-2">
              <p className="text-xs text-muted">{d.yourName}</p>
              <p className="truncate text-lg font-semibold">{v.name || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{d.from}</p>
              <p className="font-medium">{home.flag} {home.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{d.to}</p>
              <p className="font-medium">{dest.flag} {dest.name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{d.studentType}</p>
              <p className="font-medium">{v.studentType === "exchange" ? d.exchange : d.degree}</p>
            </div>
            <div>
              <p className="text-xs text-muted">{d.stay}</p>
              <p className="font-medium">{d.stayOptions[stayIdx] ?? `${v.stayMonths} mo`}</p>
            </div>
          </div>
          <div className="mrz border-t border-border bg-surface-2 px-5 py-3 text-[11px] leading-5 opacity-80 sm:text-xs" aria-hidden>
            <div>{l1}</div>
            <div>{l2}</div>
          </div>
        </div>
      </section>

      <form
        className="space-y-4 rounded-2xl border border-border bg-surface p-5 md:p-7"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(v);
        }}
      >
        <label className={label}>
          {d.language}
          <select className={field} value={v.language} onChange={(e) => set("language", e.target.value as Lang)}>
            {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
        <label className={label}>
          {d.yourName}
          <input className={field} value={v.name} maxLength={60} autoComplete="given-name" onChange={(e) => set("name", e.target.value)} />
        </label>
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className={label}>
            {d.from}
            <select className={field} value={v.homeCountry} onChange={(e) => set("homeCountry", e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            aria-label="Swap"
            className="mb-1 h-10 w-10 rounded-full border border-border text-muted hover:text-text"
            onClick={() => setV((s) => ({ ...s, homeCountry: s.destCountry, destCountry: s.homeCountry }))}
          >
            <ArrowLeftRight aria-hidden className="mx-auto h-4 w-4" />
          </button>
          <label className={label}>
            {d.to}
            <select className={field} value={v.destCountry} onChange={(e) => set("destCountry", e.target.value)}>
              {(DESTINATIONS.some((c) => c.code === v.destCountry) ? DESTINATIONS : [...DESTINATIONS, COUNTRIES.find((c) => c.code === v.destCountry)!])
                .map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className={label}>
            {d.studentType}
            <select className={field} value={v.studentType} onChange={(e) => set("studentType", e.target.value as StudentType)}>
              <option value="exchange">{d.exchange}</option>
              <option value="degree">{d.degree}</option>
            </select>
          </label>
          <label className={label}>
            {d.stay}
            <select className={field} value={v.stayMonths} onChange={(e) => set("stayMonths", Number(e.target.value))}>
              {STAY_MONTHS.map((m, i) => <option key={m} value={m}>{d.stayOptions[i]}</option>)}
            </select>
          </label>
        </div>
        <label className={label}>
          {d.university}
          <input className={field} value={v.university} maxLength={120} placeholder={d.universityPlaceholder} onChange={(e) => set("university", e.target.value)} />
        </label>
        {error && <p className="rounded-lg bg-bad-soft p-3 text-sm text-bad">{error}</p>}
        <button
          disabled={busy || v.homeCountry === v.destCountry}
          className="w-full rounded-lg bg-ink py-3 text-base font-semibold text-on-ink disabled:opacity-50"
        >
          {busy ? d.starting : d.start}
        </button>
        <p className="text-center text-xs text-muted">{d.sandboxNote}</p>
      </form>
    </main>
  );
}
