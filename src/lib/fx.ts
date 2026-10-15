import { CURRENCIES, type CurrencyCode, roundTo } from "./countries";

// Sandbox FX engine. Rates move deterministically day by day (a smooth wave
// per currency) so the agent has a believable 30-day history to reason about,
// and tests are reproducible.

const DAY_MS = 86_400_000;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function dayIndex(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

/** Units of `code` per USD on a given day. USD is the anchor and never moves. */
export function perUsdOn(code: CurrencyCode, date: Date): number {
  const base = CURRENCIES[code].perUsd;
  if (code === "USD") return base;
  const phase = hash(code) * Math.PI * 2;
  const d = dayIndex(date);
  // ±1.5% slow wave + ±0.4% fast wave
  const drift = 0.015 * Math.sin(d / 9 + phase) + 0.004 * Math.sin(d / 2.3 + phase * 3);
  return base * (1 + drift);
}

/** Mid-market rate: how many `to` you get for 1 `from`. */
export function midRate(from: CurrencyCode, to: CurrencyCode, date = new Date()): number {
  if (from === to) return 1;
  return perUsdOn(to, date) / perUsdOn(from, date);
}

export function toUsd(code: CurrencyCode, amount: number, date = new Date()): number {
  return amount / perUsdOn(code, date);
}

export function fromUsd(code: CurrencyCode, usd: number, date = new Date()): number {
  return usd * perUsdOn(code, date);
}

export interface FxQuote {
  from: CurrencyCode;
  to: CurrencyCode;
  amount: number;
  midRate: number;
  /** Rate after the in-app conversion margin. */
  rate: number;
  marginPct: number;
  receive: number;
  avg30: number;
  /** Positive = today's rate is better than the 30-day average for the sender. */
  vsAvg30Pct: number;
  trend: "better_than_usual" | "worse_than_usual" | "normal";
  asOf: string;
}

export const APP_FX_MARGIN_PCT = 0.35;

export function quote(from: CurrencyCode, to: CurrencyCode, amount: number, date = new Date()): FxQuote {
  const mid = midRate(from, to, date);
  const rate = mid * (1 - APP_FX_MARGIN_PCT / 100);
  let sum = 0;
  for (let i = 0; i < 30; i++) sum += midRate(from, to, new Date(date.getTime() - i * DAY_MS));
  const avg30 = sum / 30;
  const vsAvg30Pct = ((mid - avg30) / avg30) * 100;
  return {
    from, to, amount,
    midRate: mid,
    rate,
    marginPct: APP_FX_MARGIN_PCT,
    receive: roundTo(to, amount * rate),
    avg30,
    vsAvg30Pct: Math.round(vsAvg30Pct * 100) / 100,
    trend: vsAvg30Pct > 0.5 ? "better_than_usual" : vsAvg30Pct < -0.5 ? "worse_than_usual" : "normal",
    asOf: date.toISOString(),
  };
}

/** Daily mid-rate history, oldest first. */
export function history(from: CurrencyCode, to: CurrencyCode, days: number, date = new Date()) {
  const out: { date: string; rate: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(date.getTime() - i * DAY_MS);
    out.push({ date: d.toISOString().slice(0, 10), rate: midRate(from, to, d) });
  }
  return out;
}
