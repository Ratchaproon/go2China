import { type LedgerState, audit } from "./ledger";
import { evaluate } from "./policy";
import { applyDueLimits } from "./limits";
import { applyAction } from "./tools";

// Human-in-the-loop execution path. Only the user's Approve/Reject buttons reach
// this code; the model has no tool that calls it.

/** Housekeeping run on every request: apply limit increases that have finished their wait, and expire stale proposals. */
export function expirePending(state: LedgerState, now = new Date()) {
  applyDueLimits(state, now);
  const keep = [];
  for (const p of state.pending) {
    if (Date.parse(p.expiresAt) <= now.getTime()) {
      audit(state, { actor: "system", action: `${p.action.kind}`, tier: p.tier, decision: "expired", detail: p.summary, refId: p.id }, now);
    } else keep.push(p);
  }
  state.pending = keep;
}

export type DecisionOutcome =
  | { ok: true; message: string }
  | { ok: false; message: string; reasons?: string[] };

export function decide(state: LedgerState, actionId: string, approve: boolean, now = new Date()): DecisionOutcome {
  expirePending(state, now);
  const idx = state.pending.findIndex((p) => p.id === actionId);
  if (idx < 0) return { ok: false, message: "This request no longer exists or has expired. Ask the assistant to prepare it again." };
  const p = state.pending[idx];
  state.pending.splice(idx, 1);

  if (!approve) {
    audit(state, { actor: "user", action: `reject_${p.action.kind}`, tier: p.tier, decision: "rejected", detail: p.summary, refId: p.id }, now);
    return { ok: true, message: `Rejected: ${p.summary}` };
  }

  // Re-check policy at execution time: balances, limits and payees may have changed since the proposal.
  const res = evaluate(state, p.action, now);
  if (res.decision === "block") {
    audit(state, { actor: "policy", action: res.checks.find((c) => !c.ok)?.id ?? "policy_check", tier: p.tier, decision: "blocked", detail: `At approval: ${res.reasons.join(" ")}`, refId: p.id }, now);
    return { ok: false, message: `Blocked at execution: ${p.summary}`, reasons: res.reasons };
  }
  try {
    applyAction(state, p.action, now);
  } catch (e) {
    audit(state, { actor: "system", action: p.action.kind, tier: p.tier, decision: "blocked", detail: `${p.summary}. ${(e as Error).message}`, refId: p.id }, now);
    return { ok: false, message: (e as Error).message };
  }
  audit(state, { actor: "user", action: `approve_${p.action.kind}`, tier: p.tier, decision: "approved", detail: p.summary, refId: p.id }, now);
  audit(state, { actor: "system", action: `execute_${p.action.kind}`, tier: p.tier, decision: "executed", detail: p.summary, refId: p.id }, now);
  return { ok: true, message: `Done: ${p.summary}` };
}
