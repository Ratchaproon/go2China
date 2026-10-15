import { createInitialState, type LedgerState } from "@/lib/ledger";
import type { UiCard } from "@/lib/tools";

export const NOW = new Date("2026-10-14T08:00:00Z");

export function freshState(overrides: Partial<LedgerState["settings"]> = {}): LedgerState {
  const s = createInitialState(
    { name: "Ploy", homeCountry: "TH", destCountry: "CN", language: "th", university: "Demo University of China", studentId: "S1234567" },
    NOW,
  );
  Object.assign(s.settings, overrides);
  return s;
}

export function ctx(state: LedgerState, now = NOW) {
  return { state, now, cards: [] as UiCard[] };
}
