import { type LedgerState, type Settings, audit } from "./ledger";

// Spending-limit rules. Only the student changes limits, from Settings; the
// agent has no tool that can. Lowering a limit is always safe, so it applies at
// once. Raising one needs the PIN and only takes effect after a cooling-off
// period, so someone who takes over the account can't raise the limit and
// empty it straight away.

export type LimitKey = "perTxnLimitUsd" | "dailyLimitUsd" | "autoApproveLimitUsd";
export const LIMIT_KEYS: LimitKey[] = ["perTxnLimitUsd", "dailyLimitUsd", "autoApproveLimitUsd"];

/** Absolute ceilings no setting can exceed (also enforced in the policy engine). */
export const HARD_MAX: Record<LimitKey, number> = {
  perTxnLimitUsd: 5_000,
  dailyLimitUsd: 10_000,
  autoApproveLimitUsd: 500,
};

export const COOLING_OFF_HOURS = 24;

/** Sandbox PIN, shown on screen in the demo. A real app would verify a PIN or biometric on the device. */
export const DEMO_PIN = "2580";

const LABEL: Record<LimitKey, string> = {
  perTxnLimitUsd: "Per-payment limit",
  dailyLimitUsd: "Daily limit",
  autoApproveLimitUsd: "Autopilot limit",
};

const usd = (n: number) => `USD ${n.toLocaleString("en")}`;

export interface ScheduledLimit {
  to: number;
  effectiveAt: string;
}

export interface SettingsChange {
  agentMode?: Settings["agentMode"];
  limits?: Partial<Record<LimitKey, number>>;
  pin?: string;
}

export type ChangeResult =
  | { ok: true; applied: string[]; scheduled: string[] }
  | { ok: false; error: "pin_required" | "pin_wrong" | "above_max"; message: string };

/** Whether a change needs the PIN: any limit increase, or turning on autopilot. */
export function needsPin(state: LedgerState, change: SettingsChange): boolean {
  if (change.agentMode === "autopilot" && state.settings.agentMode !== "autopilot") return true;
  return LIMIT_KEYS.some((k) => {
    const v = change.limits?.[k];
    // Re-sending an increase that's already scheduled isn't a new increase.
    return v != null && v > state.settings[k] && state.scheduledLimits?.[k]?.to !== v;
  });
}

export function applySettingsChange(state: LedgerState, change: SettingsChange, now = new Date()): ChangeResult {
  for (const k of LIMIT_KEYS) {
    const v = change.limits?.[k];
    if (v != null && (v < 0 || v > HARD_MAX[k])) {
      return { ok: false, error: "above_max", message: `${LABEL[k]} can't be more than ${usd(HARD_MAX[k])}.` };
    }
  }
  if (needsPin(state, change)) {
    if (!change.pin) return { ok: false, error: "pin_required", message: "Enter your PIN to raise a limit or turn on Autopilot." };
    if (change.pin !== DEMO_PIN) return { ok: false, error: "pin_wrong", message: "That PIN is incorrect." };
  }

  const applied: string[] = [];
  const scheduled: string[] = [];
  state.scheduledLimits ??= {};

  if (change.agentMode && change.agentMode !== state.settings.agentMode) {
    const detail = `Agent mode ${state.settings.agentMode} → ${change.agentMode}${change.agentMode === "autopilot" ? ", PIN verified" : ""}`;
    state.settings.agentMode = change.agentMode;
    audit(state, { actor: "user", action: "change_mode", tier: "L3", decision: "approved", detail }, now);
    applied.push(detail);
  }

  for (const k of LIMIT_KEYS) {
    const v = change.limits?.[k];
    if (v == null) continue;
    const cur = state.settings[k];
    if (v < cur) {
      state.settings[k] = v;
      delete state.scheduledLimits[k]; // a decrease also cancels any pending increase
      const detail = `${LABEL[k]} ${usd(cur)} → ${usd(v)}, lower limits apply now`;
      audit(state, { actor: "user", action: "change_limit", tier: "L3", decision: "approved", detail }, now);
      applied.push(detail);
    } else if (v > cur && state.scheduledLimits[k]?.to !== v) {
      const effectiveAt = new Date(now.getTime() + COOLING_OFF_HOURS * 3_600_000);
      state.scheduledLimits[k] = { to: v, effectiveAt: effectiveAt.toISOString() };
      const detail = `${LABEL[k]} ${usd(cur)} → ${usd(v)}, PIN verified, takes effect ${effectiveAt.toISOString().slice(0, 16).replace("T", " ")} UTC`;
      audit(state, { actor: "user", action: "change_limit", tier: "L3", decision: "scheduled", detail }, now);
      scheduled.push(detail);
    }
  }
  return { ok: true, applied, scheduled };
}

export function cancelScheduled(state: LedgerState, key: LimitKey, now = new Date()) {
  const s = state.scheduledLimits?.[key];
  if (!s) return;
  delete state.scheduledLimits![key];
  audit(state, { actor: "user", action: "change_limit", tier: "L3", decision: "rejected", detail: `Cancelled scheduled ${LABEL[key].toLowerCase()} increase to ${usd(s.to)}` }, now);
}

/** Apply scheduled increases whose cooling-off period has passed. */
export function applyDueLimits(state: LedgerState, now = new Date()) {
  for (const k of LIMIT_KEYS) {
    const s = state.scheduledLimits?.[k];
    if (!s || Date.parse(s.effectiveAt) > now.getTime()) continue;
    const from = state.settings[k];
    state.settings[k] = Math.min(s.to, HARD_MAX[k]);
    delete state.scheduledLimits![k];
    audit(state, { actor: "system", action: "change_limit", tier: "L3", decision: "executed", detail: `${LABEL[k]} ${usd(from)} → ${usd(state.settings[k])} after the ${COOLING_OFF_HOURS}-hour wait` }, now);
  }
}

/** The limit actually enforced: the setting, never above the hard maximum. */
export function effectiveLimit(state: LedgerState, k: LimitKey): number {
  return Math.min(state.settings[k], HARD_MAX[k]);
}
