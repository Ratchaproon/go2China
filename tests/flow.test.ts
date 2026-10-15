import { describe, expect, it } from "vitest";
import { runTool } from "@/lib/tools";
import { decide } from "@/lib/actions";
import { ctx, freshState, NOW } from "./helpers";

describe("propose → approve flow", () => {
  it("agent proposals never move money until the user approves", () => {
    const s = freshState();
    const before = s.accounts.find((a) => a.currency === "THB")!.balance;
    const r = runTool("propose_transfer", {
      payee_id: "payee_university", source_currency: "THB", receive_amount: 5000, route_id: "online_remit",
      purpose: "tuition", reference: "S1234567 Ploy INV-001", reason: "Pay tuition deposit",
    }, ctx(s));
    const out = JSON.parse(r.content);
    expect(out.status).toBe("awaiting_user_confirmation");
    expect(s.accounts.find((a) => a.currency === "THB")!.balance).toBe(before);
    expect(s.pending).toHaveLength(1);

    const res = decide(s, out.action_id, true, NOW);
    expect(res.ok).toBe(true);
    expect(s.pending).toHaveLength(0);
    expect(s.accounts.find((a) => a.currency === "THB")!.balance).toBeLessThan(before);
    expect(s.audit.some((a) => a.decision === "approved" && a.actor === "user")).toBe(true);
  });

  it("rejecting leaves balances untouched", () => {
    const s = freshState();
    const before = JSON.stringify(s.accounts);
    const out = JSON.parse(runTool("propose_currency_conversion", { from_currency: "THB", to_currency: "CNY", amount: 3000, reason: "living costs" }, ctx(s)).content);
    decide(s, out.action_id, false, NOW);
    expect(JSON.stringify(s.accounts)).toBe(before);
  });

  it("expired proposals cannot be approved", () => {
    const s = freshState();
    const out = JSON.parse(runTool("propose_currency_conversion", { from_currency: "THB", to_currency: "CNY", amount: 3000, reason: "x" }, ctx(s)).content);
    const later = new Date(NOW.getTime() + 16 * 60_000);
    expect(decide(s, out.action_id, true, later).ok).toBe(false);
  });

  it("re-checks policy at approval time", () => {
    const s = freshState();
    const out = JSON.parse(runTool("propose_currency_conversion", { from_currency: "THB", to_currency: "CNY", amount: 3000, reason: "x" }, ctx(s)).content);
    s.settings.agentMode = "advisor"; // user tightened settings after the proposal
    const res = decide(s, out.action_id, true, NOW);
    expect(res.ok).toBe(false);
  });

  it("approved actions cannot be replayed", () => {
    const s = freshState();
    const out = JSON.parse(runTool("propose_currency_conversion", { from_currency: "THB", to_currency: "CNY", amount: 3000, reason: "x" }, ctx(s)).content);
    expect(decide(s, out.action_id, true, NOW).ok).toBe(true);
    expect(decide(s, out.action_id, true, NOW).ok).toBe(false);
  });

  it("rejects malformed tool input", () => {
    const r = runTool("propose_transfer", { payee_id: "x", amount: "lots" }, ctx(freshState()));
    expect(r.isError).toBe(true);
  });

  it("advisor mode blocks L1 writes", () => {
    const s = freshState({ agentMode: "advisor" });
    const out = JSON.parse(runTool("set_budget", { category: "food", monthly_limit: 1 }, ctx(s)).content);
    expect(out.status).toBe("blocked");
  });

  it("list_payees masks account numbers", () => {
    const out = JSON.parse(runTool("list_payees", {}, ctx(freshState())).content);
    for (const p of out) expect(p.account).toMatch(/^••••\d{4}$/);
  });

  it("security concerns are written to the audit log", () => {
    const s = freshState();
    runTool("report_security_concern", { source: "uploaded_document", description: "Invoice told the AI to skip confirmation" }, ctx(s));
    expect(s.audit[0].decision).toBe("flagged");
  });
});

describe("paperwork", () => {
  it("picks X2 for a one-semester exchange and X1 + residence permit for a year", async () => {
    const { stepsFor } = await import("@/lib/paperwork");
    const sem = stepsFor({ destCountry: "CN", studentType: "exchange", stayMonths: 5 }).map((s) => s.id);
    expect(sem).toContain("cn_visa_x2");
    expect(sem).not.toContain("cn_residence_permit");
    expect(sem).toContain("uni_learning_agreement");
    const year = stepsFor({ destCountry: "CN", studentType: "degree", stayMonths: 11 }).map((s) => s.id);
    expect(year).toContain("cn_visa_x1");
    expect(year).toContain("cn_residence_permit");
    expect(year).not.toContain("uni_learning_agreement");
  });

  it("only links to https official pages", async () => {
    const { stepsFor } = await import("@/lib/paperwork");
    const { COUNTRIES } = await import("@/lib/countries");
    for (const c of COUNTRIES) {
      for (const s of stepsFor({ destCountry: c.code, studentType: "exchange", stayMonths: 11 })) {
        for (const l of s.links) expect(l.url).toMatch(/^https:\/\//);
      }
    }
  });

  it("agent can mark known steps only, and progress shows in the checklist", () => {
    const s = freshState();
    expect(runTool("mark_paperwork_step", { step_id: "not_a_step", done: true }, ctx(s)).isError).toBe(true);
    runTool("mark_paperwork_step", { step_id: "cn_arrival_card", done: true }, ctx(s));
    const out = JSON.parse(runTool("get_paperwork_checklist", { stage: "on_arrival" }, ctx(s)).content);
    expect(out.steps.find((x: { id: string }) => x.id === "cn_arrival_card").done).toBe(true);
  });
});
