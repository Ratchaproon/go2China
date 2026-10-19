import { describe, expect, it } from "vitest";
import { midRate, quote } from "@/lib/fx";
import { compareRoutes } from "@/lib/routes";
import { NOW } from "./helpers";

describe("fx", () => {
  it("is consistent in both directions", () => {
    expect(midRate("THB", "CNY", NOW) * midRate("CNY", "THB", NOW)).toBeCloseTo(1, 10);
  });
  it("applies the margin", () => {
    const q = quote("THB", "CNY", 1000, NOW);
    expect(q.rate).toBeLessThan(q.midRate);
  });
});

describe("routes", () => {
  it("puts eligible routes first and cheapest first", () => {
    const opts = compareRoutes("THB", "CNY", 20_000, "tuition", NOW);
    const eligible = opts.filter((o) => o.eligible);
    expect(opts.slice(0, eligible.length).every((o) => o.eligible)).toBe(true);
    for (let i = 1; i < eligible.length; i++) expect(eligible[i].totalCost).toBeGreaterThanOrEqual(eligible[i - 1].totalCost);
    expect(opts.find((o) => o.routeId === "wallet_topup")!.eligible).toBe(false);
  });
});

describe("saving vs bank wire", () => {
  it("is positive when a cheaper eligible route exists", async () => {
    const { savingVsWire } = await import("@/lib/routes");
    expect(savingVsWire(compareRoutes("THB", "CNY", 16_300, "tuition", NOW))).toBeGreaterThan(0);
  });
});
