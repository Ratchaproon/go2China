"use client";
import { useMemo, useState } from "react";
import { Check, GraduationCap, MapPin, Star } from "lucide-react";
import { Ic, PLACE_ICON } from "./icons";
import { formatMoney, getCountry } from "@/lib/countries";
import { midRate } from "@/lib/fx";
import type { Dict } from "@/lib/i18n";
import type { Lang, LedgerState } from "@/lib/ledger";
import {
  type Place, type PlaceCategory, type PlaceSort, PLACE_CATEGORIES,
  campusFor, generatePlaces, mapsLinks, mealBudget, realSearchLink, searchPlaces,
} from "@/lib/places";
import { ExtLink } from "./Markdown";


function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <span className="inline-flex gap-px align-[-0.12em] text-accent" aria-label={`${rating} / 5`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Star key={i} aria-hidden className={`h-3.5 w-3.5 ${i < full ? "fill-current" : "opacity-30"}`} strokeWidth={1.5} />
      ))}
    </span>
  );
}

function budgetFor(state: LedgerState) {
  const foodBudget = state.budgets.find((b) => b.category === "food")?.monthlyLimit;
  return mealBudget(foodBudget, state.profile.destCountry);
}

function PlaceRow({
  p, state, lang, d, perMeal, selected, onSelect,
}: { p: Place; state: LedgerState; lang: Lang; d: Dict; perMeal: number; selected: boolean; onSelect: () => void }) {
  const home = getCountry(state.profile.homeCountry).currency;
  const stay = p.category === "hotel" || p.category === "hostel";
  const fits = !stay && p.price <= perMeal;
  const links = mapsLinks(p);
  return (
    <div className={`rounded-2xl border p-4 ${selected ? "border-brand bg-brand-soft/40" : "border-border bg-surface"}`}>
      <button onClick={onSelect} className="w-full text-left">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand"><Ic icon={PLACE_ICON[p.category]} /></span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{p.name}</p>
            <p className="text-sm">
              <Stars rating={p.rating} /> <b>{p.rating.toFixed(1)}</b>
              <span className="text-muted"> ({p.reviewCount.toLocaleString(lang)} {d.reviewsLabel})</span>
            </p>
            <p className="tabular mt-1 text-sm">
              <b>{formatMoney(p.currency, p.price, lang)}</b> <span className="text-muted">{stay ? d.perNight : d.perPerson}</span>
              <span className="ml-1.5 text-muted">≈ {formatMoney(home, p.price * midRate(p.currency, home), lang)}</span>
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
              {p.cuisine && <span>{p.cuisine}</span>}
              <span>{p.distanceKm} km {d.away}</span>
              <span aria-label={`price level ${p.priceLevel} of 4`}>{"$".repeat(p.priceLevel)}<span className="opacity-30">{"$".repeat(4 - p.priceLevel)}</span></span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
              {!stay && (
                <span className={`rounded-full px-2 py-0.5 font-semibold ${fits ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>
                  {fits ? <><Ic icon={Check} className="mr-0.5" />{d.fitsBudget}</> : d.overBudget}
                </span>
              )}
              {p.studentDiscount && <span className="rounded-full bg-brand-soft px-2 py-0.5 font-semibold text-brand"><Ic icon={GraduationCap} className="mr-1" />{d.studentDiscountLabel}</span>}
            </div>
          </div>
        </div>
      </button>
      {selected && (
        <div className="mt-3 space-y-3">
          <iframe
            title={p.name}
            src={links.embed}
            className="h-56 w-full rounded-xl border border-border"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="space-y-1.5">
            {p.reviews.map((r, i) => (
              <p key={i} className="rounded-xl bg-surface-2 px-3 py-2 text-sm">
                <Stars rating={r.stars} /> “{r.text}” <span className="text-muted">— {r.author}</span>
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <ExtLink href={links.view}>{d.openMaps}</ExtLink>
            <ExtLink href={links.directions}>{d.directions}</ExtLink>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlacesPanel({ state, lang, d }: { state: LedgerState; lang: Lang; d: Dict }) {
  const [cat, setCat] = useState<PlaceCategory>("food");
  const [sort, setSort] = useState<PlaceSort>("value");
  const [selected, setSelected] = useState<string | null>(null);
  const dest = state.profile.destCountry;
  const places = useMemo(() => searchPlaces(dest, { category: cat, sort }), [dest, cat, sort]);
  const perMeal = budgetFor(state);
  const campus = campusFor(dest, state.profile.university);
  const dc = getCountry(dest).currency;
  const chip = (on: boolean) => `shrink-0 rounded-full border px-3 py-1.5 text-sm ${on ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border"}`;
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-surface p-5">
        <p className="text-lg font-semibold"><Ic icon={MapPin} className="mr-1.5 text-brand" />{d.places}</p>
        <p className="text-sm text-muted">{campus.name}</p>
        <p className="mt-2 text-sm">{d.placesIntro}</p>
        <p className="tabular mt-2 text-sm">{d.mealBudgetLabel}: <b>{formatMoney(dc, perMeal, lang)}</b></p>
        <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-xs text-warn">{d.demoData}</p>
      </section>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {PLACE_CATEGORIES.map((c) => (
          <button key={c} className={chip(cat === c)} onClick={() => { setCat(c); setSelected(null); }}>
            <Ic icon={PLACE_ICON[c]} className="mr-1" />{d.placeCats[c]}
          </button>
        ))}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["value", "rating", "price", "distance"] as PlaceSort[]).map((s) => (
          <button key={s} className={chip(sort === s)} onClick={() => setSort(s)}>{d.sorts[s]}</button>
        ))}
      </div>
      <div className="space-y-2">
        {places.map((p) => (
          <PlaceRow
            key={p.id} p={p} state={state} lang={lang} d={d} perMeal={perMeal}
            selected={selected === p.id} onSelect={() => setSelected(selected === p.id ? null : p.id)}
          />
        ))}
      </div>
      <p className="text-sm">
        <ExtLink href={realSearchLink(cat, undefined, campus)}>{d.findReal}</ExtLink>
      </p>
    </div>
  );
}

/** Card in chat showing the places the agent picked, with a map of the top one. */
export function PlacesCard({
  state, lang, d, ids, onOpen,
}: { state: LedgerState; lang: Lang; d: Dict; ids: string[]; onOpen: () => void }) {
  const all = useMemo(() => generatePlaces(state.profile.destCountry), [state.profile.destCountry]);
  const picked = ids.map((id) => all.find((p) => p.id === id)).filter((p): p is Place => !!p);
  const [selected, setSelected] = useState<string | null>(picked[0]?.id ?? null);
  if (!picked.length) return null;
  const perMeal = budgetFor(state);
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-3">
      <p className="px-1 text-sm font-semibold text-muted"><Ic icon={MapPin} className="mr-1" />{d.places}: {d.placeCats[picked[0].category]}</p>
      {picked.slice(0, 4).map((p) => (
        <PlaceRow
          key={p.id} p={p} state={state} lang={lang} d={d} perMeal={perMeal}
          selected={selected === p.id} onSelect={() => setSelected(selected === p.id ? null : p.id)}
        />
      ))}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs text-muted">{d.demoData}</span>
        <button onClick={onOpen} className="shrink-0 rounded-xl border border-brand px-3 py-1.5 text-sm font-semibold text-brand">{d.places}</button>
      </div>
    </div>
  );
}
