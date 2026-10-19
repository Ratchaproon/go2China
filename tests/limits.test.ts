import { describe, expect, it } from "vitest";
import { DEMO_PIN, HARD_MAX, applyDueLimits, applySettingsChange, cancelScheduled } from "@/lib/limits";
import { evaluate } from "@/lib/policy";
import { runTool } from "@/lib/tools";
import { invoiceAmount } from "@/lib/invoice";
import { fromUsd } from "@/lib/fx";
import { createInitialState } from "@/lib/ledger";
import { ctx, freshState, NOW } from "./helpers";

const HOUR = 3_600_000;

describe("spending limits", () => {
  it("defaults to about one semester of tuition, under the hard maximum", () => {
    const s = freshState();
    expect(s.settings.perTxnLimitUsd).toBe(3_000);
    expect(s.settings.dailyLimitUsd).toBe(3_500);
    expect(s.settings.perTxnLimitUsd).toBeLessThanOrEqual(HARD_MAX.perTxnLimitUsd);
  });

  it("applies decreases immediately without a PIN", () => {
    const s = freshState();
    const r = applySettingsChange(s, { limits: { perTxnLimitUsd: 1_000 } }, NOW);
    expect(r.ok).toBe(true);
    expect(s.settings.perTxnLimitUsd).toBe(1_000);
  });

  it("requires the PIN to raise a limit, then waits 24 hours", () => {
    const s = freshState();
    expect(applySettingsChange(s, { limits: { perTxnLimitUsd: 4_000 } }, NOW)).toMatchObject({ ok: false, error: "pin_required" });
    expect(applySettingsChange(s, { limits: { perTxnLimitUsd: 4_000 }, pin: "0000" }, NOW)).toMatchObject({ ok: false, error: "pin_wrong" });
    expect(applySettingsChange(s, { limits: { perTxnLimitUsd: 4_000 }, pin: DEMO_PIN }, NOW).ok).toBe(true);
    expect(s.settings.perTxnLimitUsd).toBe(3_000); // not yet
    applyDueLimits(s, new Date(NOW.getTime() + 23 * HOUR));
    expect(s.settings.perTxnLimitUsd).toBe(3_000);
    applyDueLimits(s, new Date(NOW.getTime() + 24 * HOUR + 1));
    expect(s.settings.perTxnLimitUsd).toBe(4_000);
    expect(s.audit[0]).toMatchObject({ actor: "system", action: "change_limit", decision: "executed" });
  });

  it("rejects values above the hard maximum", () => {
    const r = applySettingsChange(freshState(), { limits: { perTxnLimitUsd: 50_000 }, pin: DEMO_PIN }, NOW);
    expect(r).toMatchObject({ ok: false, error: "above_max" });
  });

  it("a scheduled increase can be cancelled, and a decrease cancels it too", () => {
    const s = freshState();
    applySettingsChange(s, { limits: { dailyLimitUsd: 6_000 }, pin: DEMO_PIN }, NOW);
    cancelScheduled(s, "dailyLimitUsd", NOW);
    applyDueLimits(s, new Date(NOW.getTime() + 48 * HOUR));
    expect(s.settings.dailyLimitUsd).toBe(3_500);
    applySettingsChange(s, { limits: { dailyLimitUsd: 6_000 }, pin: DEMO_PIN }, NOW);
    applySettingsChange(s, { limits: { dailyLimitUsd: 2_000 } }, NOW);
    applyDueLimits(s, new Date(NOW.getTime() + 48 * HOUR));
    expect(s.settings.dailyLimitUsd).toBe(2_000);
  });

  it("turning on autopilot needs the PIN", () => {
    expect(applySettingsChange(freshState(), { agentMode: "autopilot" }, NOW)).toMatchObject({ ok: false, error: "pin_required" });
  });

  it("the policy engine never enforces more than the hard maximum, even for old sessions", () => {
    const s = freshState({ perTxnLimitUsd: 15_000, dailyLimitUsd: 20_000 });
    s.accounts[0].balance = 10_000_000;
    const r = evaluate(s, { kind: "convert", params: { fromCurrency: "THB", toCurrency: "CNY", amount: 300_000, receive: 60_000, rate: 0.2 } }, NOW);
    expect(r.decision).toBe("block");
  });

  it("the agent can't change limits: the request is refused and logged", () => {
    const s = freshState();
    const out = JSON.parse(runTool("request_limit_change", { what: "raise my limit to $5,000" }, ctx(s)).content);
    expect(out.status).toBe("refused");
    expect(s.settings.perTxnLimitUsd).toBe(3_000);
    expect(s.audit[0]).toMatchObject({ actor: "agent", decision: "refused", tier: "L3" });
  });
});

describe("demo invoice fits the default limit everywhere", () => {
  for (const dest of ["CN", "JP", "KR", "SG", "MY", "TH", "GB", "US", "AU", "DE"]) {
    it(dest, () => {
      const s = createInitialState({ name: "T", homeCountry: dest === "TH" ? "VN" : "TH", destCountry: dest, language: "en", university: "", studentId: "S1" }, NOW);
      const { amount } = invoiceAmount(s);
      const cur = { CN: "CNY", JP: "JPY", KR: "KRW", SG: "SGD", MY: "MYR", TH: "THB", GB: "GBP", US: "USD", AU: "AUD", DE: "EUR" }[dest] as Parameters<typeof fromUsd>[0];
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThanOrEqual(fromUsd(cur, 3_000 * 0.9));
    });
  }
});
