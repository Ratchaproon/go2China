import { describe, expect, it } from "vitest";
import { deleteEntry, recordEntry } from "@/lib/ledger";
import { budgetReport, runTool } from "@/lib/tools";
import { ctx, freshState, NOW } from "./helpers";

const today = NOW.toISOString().slice(0, 10);

describe("logging money in and out", () => {
  it("an expense lowers the wallet, counts toward the budget and is logged as L1", () => {
    const s = freshState();
    const cny = s.accounts.find((a) => a.currency === "CNY")!;
    const before = cny.balance;
    const foodBefore = budgetReport(s, NOW).categories.find((c) => c.category === "food")!.spent;
    const r = recordEntry(s, { type: "expense", amount: 45, currency: "CNY", category: "food", note: "Dinner", date: today }, "form", NOW);
    expect(r.ok).toBe(true);
    expect(cny.balance).toBeCloseTo(before - 45, 2);
    expect(budgetReport(s, NOW).categories.find((c) => c.category === "food")!.spent).toBeCloseTo(foodBefore + 45, 2);
    expect(s.audit[0]).toMatchObject({ actor: "user", action: "record_expense", tier: "L1" });
  });

  it("income raises the wallet and doesn't count as spending", () => {
    const s = freshState();
    const thb = s.accounts.find((a) => a.currency === "THB")!;
    const before = thb.balance;
    const spentBefore = budgetReport(s, NOW).totalSpent;
    const r = recordEntry(s, { type: "income", amount: 5_000, currency: "THB", note: "Allowance from family" }, "form", NOW);
    expect(r.ok && r.txn.category).toBe("income");
    expect(thb.balance).toBeCloseTo(before + 5_000, 2);
    expect(budgetReport(s, NOW).totalSpent).toBeCloseTo(spentBefore, 2);
    expect(s.audit[0]).toMatchObject({ action: "record_income" });
  });

  it("rejects bad input", () => {
    const s = freshState();
    expect(recordEntry(s, { type: "expense", amount: 0, currency: "CNY", category: "food", note: "" }, "form", NOW).ok).toBe(false);
    expect(recordEntry(s, { type: "expense", amount: 10, currency: "CNY", category: "tuition", note: "" }, "form", NOW).ok).toBe(false);
    expect(recordEntry(s, { type: "expense", amount: 10, currency: "CNY", category: "food", note: "", date: "2099-01-01" }, "form", NOW).ok).toBe(false);
    expect(recordEntry(s, { type: "expense", amount: 999_999, currency: "CNY", category: "food", note: "" }, "form", NOW).ok).toBe(false);
    expect(recordEntry(s, { type: "income", amount: 10_000_000, currency: "THB", note: "" }, "form", NOW).ok).toBe(false);
  });

  it("only logged entries can be deleted, and deleting reverses them", () => {
    const s = freshState();
    const thb = s.accounts.find((a) => a.currency === "THB")!;
    const before = thb.balance;
    const r = recordEntry(s, { type: "income", amount: 2_000, currency: "THB", note: "Part-time job" }, "form", NOW);
    if (!r.ok) throw new Error();
    expect(deleteEntry(s, s.transactions.find((t) => !t.logged)!.id, NOW)).toBe(false);
    expect(deleteEntry(s, r.txn.id, NOW)).toBe(true);
    expect(thb.balance).toBeCloseTo(before, 2);
  });

  it("the assistant can log spending and income", () => {
    const s = freshState();
    const a = JSON.parse(runTool("record_money", { type: "expense", amount: 45, category: "food", note: "Dinner" }, ctx(s)).content);
    expect(a).toMatchObject({ status: "recorded", currency: "CNY" });
    const b = JSON.parse(runTool("record_money", { type: "income", amount: 5000, currency: "THB", note: "Allowance" }, ctx(s)).content);
    expect(b).toMatchObject({ status: "recorded", category: "income" });
    expect(s.transactions.filter((t) => t.logged === "chat")).toHaveLength(2);
  });
});
