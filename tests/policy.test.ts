import { describe, expect, it } from "vitest";
import { checkPayeeDetails, evaluate, nameSimilarity, watchlistHit } from "@/lib/policy";
import { freshState, NOW } from "./helpers";
import type { ActionParams } from "@/lib/ledger";

const convert = (amount: number): ActionParams => ({
  kind: "convert", params: { fromCurrency: "THB", toCurrency: "CNY", amount, receive: amount / 4.7, rate: 0.21 },
});

describe("policy tiers and modes", () => {
  it("copilot mode requires confirmation for every conversion", () => {
    const r = evaluate(freshState(), convert(500), NOW);
    expect(r.decision).toBe("confirm");
    expect(r.tier).toBe("L2");
  });

  it("autopilot auto-executes only small own-account conversions", () => {
    const s = freshState({ agentMode: "autopilot", autoApproveLimitUsd: 50 });
    expect(evaluate(s, convert(1000), NOW).decision).toBe("auto"); // ≈ USD 30
    expect(evaluate(s, convert(5000), NOW).decision).toBe("confirm"); // ≈ USD 150
  });

  it("advisor mode blocks all money movement", () => {
    const r = evaluate(freshState({ agentMode: "advisor" }), convert(100), NOW);
    expect(r.decision).toBe("block");
  });

  it("blocks amounts over the per-transaction limit", () => {
    const r = evaluate(freshState({ perTxnLimitUsd: 100 }), convert(10_000), NOW);
    expect(r.decision).toBe("block");
    expect(r.reasons.join(" ")).toMatch(/per-payment limit/);
  });

  it("blocks when balance is insufficient", () => {
    const r = evaluate(freshState(), convert(10_000_000), NOW);
    expect(r.decision).toBe("block");
  });
});

describe("transfers", () => {
  it("blocks payments to unknown payees", () => {
    const s = freshState();
    const r = evaluate(s, {
      kind: "transfer",
      params: { payeeId: "payee_fake", sourceCurrency: "THB", receiveAmount: 100, receiveCurrency: "CNY", routeId: "online_remit", purpose: "rent", reference: "ref 1", totalCost: 500, feeTotal: 10 },
    }, NOW);
    expect(r.decision).toBe("block");
  });

  it("blocks tuition through a rail universities don't accept", () => {
    const s = freshState();
    const r = evaluate(s, {
      kind: "transfer",
      params: { payeeId: "payee_university", sourceCurrency: "THB", receiveAmount: 1000, receiveCurrency: "CNY", routeId: "wallet_topup", purpose: "tuition", reference: "S1234567", totalCost: 4800, feeTotal: 0 },
    }, NOW);
    expect(r.decision).toBe("block");
  });

  it("flags large transfers as high risk but still allows confirmation", () => {
    const s = freshState();
    s.accounts[0].balance = 1_000_000;
    const r = evaluate(s, {
      kind: "transfer",
      params: { payeeId: "payee_university", sourceCurrency: "THB", receiveAmount: 19_000, receiveCurrency: "CNY", routeId: "uni_platform", purpose: "tuition", reference: "S1234567 Ploy INV-1", totalCost: 90_000, feeTotal: 0 },
    }, NOW);
    expect(r.decision).toBe("confirm");
    expect(r.risk).toBe("high");
  });

  it("blocks transfers above the hard maximum even if an old session had higher limits", () => {
    const s = freshState({ perTxnLimitUsd: 15_000, dailyLimitUsd: 20_000 });
    s.accounts[0].balance = 1_000_000;
    const r = evaluate(s, {
      kind: "transfer",
      params: { payeeId: "payee_university", sourceCurrency: "THB", receiveAmount: 80_000, receiveCurrency: "CNY", routeId: "uni_platform", purpose: "tuition", reference: "S1234567 Ploy INV-1", totalCost: 380_000, feeTotal: 0 },
    }, NOW);
    expect(r.decision).toBe("block");
  });
});

describe("payee screening", () => {
  it("detects look-alike payee with different bank account (invoice fraud)", () => {
    const s = freshState();
    const r = evaluate(s, {
      kind: "add_payee",
      params: { name: "Demo University of China - Finance Office", kind: "university", country: "CN", currency: "CNY", bankName: "Other Bank", accountNumber: "999988887777", source: "uploaded_document" },
    }, NOW);
    expect(r.decision).toBe("confirm");
    expect(r.risk).toBe("high");
    expect(r.reasons.join(" ")).toMatch(/invoice fraud/i);
  });

  it("blocks watchlisted names", () => {
    expect(watchlistHit("SHADOW capital holdings ltd")).toBeTruthy();
    const r = evaluate(freshState(), {
      kind: "add_payee",
      params: { name: "Shadow Capital Holdings", kind: "person", country: "CN", currency: "CNY", bankName: "X Bank", accountNumber: "123456789", source: "user_message" },
    }, NOW);
    expect(r.decision).toBe("block");
  });

  it("name similarity is token based", () => {
    expect(nameSimilarity("Demo University of China", "demo university of china finance")).toBe(1);
    expect(nameSimilarity("Alice Wong", "Bob Lee")).toBe(0);
  });
});

describe("changed bank details under a trusted name", () => {
  it("blocks adding a payee with the exact name of a verified payee but a different account", () => {
    const s = freshState();
    const r = evaluate(s, {
      kind: "add_payee",
      params: { name: "Demo University of China", kind: "university", country: "CN", currency: "CNY", bankName: "Global Express Settlement Bank", accountNumber: "6210993744028815", source: "uploaded_document" },
    }, NOW);
    expect(r.decision).toBe("block");
    expect(r.checks.find((c) => c.id === "check_payee")?.ok).toBe(false);
    expect(r.reasons.join(" ")).toMatch(/doesn't match your verified payee/);
  });

  it("checkPayeeDetails: match, mismatch, lookalike and new", () => {
    const s = freshState();
    const uni = s.payees.find((p) => p.id === "payee_university")!;
    expect(checkPayeeDetails(s, uni.name, uni.accountNumber).result).toBe("match");
    expect(checkPayeeDetails(s, uni.name, "6210993744028815").result).toBe("mismatch");
    expect(checkPayeeDetails(s, `${uni.name} Finance Office`, "6210993744028815").result).toBe("lookalike");
    expect(checkPayeeDetails(s, "Someone Else", "123456789").result).toBe("new");
  });

  it("records passed checks in plain words for transfers", () => {
    const r = evaluate(freshState(), {
      kind: "transfer",
      params: { payeeId: "payee_university", sourceCurrency: "THB", receiveAmount: 1000, receiveCurrency: "CNY", routeId: "uni_platform", purpose: "tuition", reference: "S1234567", totalCost: 4800, feeTotal: 0 },
    }, NOW);
    expect(r.checks.find((c) => c.id === "check_payee")?.detail).toMatch(/matches your verified payee/);
    expect(r.checks.find((c) => c.id === "check_limits")?.ok).toBe(true);
  });
});
