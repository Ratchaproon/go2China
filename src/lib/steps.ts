// Turns tool calls into the "what I'm doing" steps the student sees while the
// agent works. Step results are worded by code from the tool output, so the
// model can't claim a check passed when it didn't.

export type StepStatus = "ok" | "warn" | "fail" | "wait";

export interface AgentStep {
  /** Tool name, policy check id, or "read_document" / "waiting"; used to pick a translated label. */
  key: string;
  status: StepStatus;
  /** Plain-English result written by code (amounts, account endings, limits). */
  detail?: string;
}

const QUIET = new Set(["get_overview", "list_pending_actions"]);

type Out = Record<string, unknown>;
type Check = { id: string; ok: boolean; detail: string };

export function stepsForTool(name: string, raw: string, isError: boolean): AgentStep[] {
  if (QUIET.has(name)) return [];
  if (isError) return [{ key: name, status: "fail", detail: raw.replace(/^Error: /, "").slice(0, 200) }];
  let out: Out;
  try {
    out = JSON.parse(raw);
  } catch {
    return [{ key: name, status: "ok" }];
  }
  switch (name) {
    case "verify_payee_details":
      return [{ key: "check_payee", status: out.result === "match" ? "ok" : out.result === "mismatch" ? "fail" : "warn", detail: String(out.detail) }];
    case "compare_transfer_routes": {
      const opts = (out.options as { name: string; eligible: boolean; totalCost: number }[]) ?? [];
      const ok = opts.filter((o) => o.eligible);
      if (!ok.length) return [{ key: name, status: "warn", detail: "No route is available for this payment." }];
      const best = ok[0], worst = ok[ok.length - 1];
      const saving = worst.totalCost - best.totalCost;
      return [{
        key: name, status: "ok",
        detail: `Compared ${opts.length} ways to pay. ${best.name} is cheapest${saving > 0 ? `, saving ${Math.round(saving).toLocaleString("en")} ${out.source_currency ?? ""} vs the most expensive option` : ""}.`,
      }];
    }
    case "get_fx_quote":
      return [{ key: name, status: "ok", detail: `1 ${out.from} = ${Number(out.rate).toFixed(4)} ${out.to} (${Number(out.vsAvg30Pct) > 0 ? "+" : ""}${out.vsAvg30Pct}% vs 30-day average)` }];
    case "analyze_budget":
      return [{ key: name, status: "ok", detail: `Spent ${Math.round(Number(out.totalSpent)).toLocaleString("en")} ${out.currency} in 30 days, budget ${Math.round(Number(out.totalBudget)).toLocaleString("en")} ${out.currency}.` }];
    case "record_money":
      return out.status === "recorded"
        ? [{ key: name, status: "ok", detail: `${out.type === "income" ? "+" : "−"}${out.amount} ${out.currency} ${out.category}: ${out.note}` }]
        : [{ key: name, status: "warn", detail: String(out.reason) }];
    case "report_security_concern":
      return [{ key: name, status: "warn" }];
    case "request_limit_change":
      return [{ key: name, status: "fail", detail: "The assistant can't change limits. Change them yourself in Settings." }];
    case "propose_transfer":
    case "propose_currency_conversion":
    case "propose_add_payee": {
      const checks = ((out.checks ?? out.checks_passed) as Check[] | undefined) ?? [];
      const steps: AgentStep[] = checks
        .filter((c) => c.id === "check_payee" || c.id === "check_limits" || !c.ok)
        .map((c) => ({ key: c.id, status: c.ok ? "ok" : "fail", detail: c.detail }));
      if (out.status === "blocked") steps.push({ key: name, status: "fail", detail: ((out.reasons as string[]) ?? [])[0] });
      else if (out.status === "executed_automatically") steps.push({ key: name, status: "ok", detail: String(out.summary) });
      else steps.push({ key: name, status: "ok", detail: String(out.summary) }, { key: "waiting", status: "wait" });
      return steps;
    }
    default:
      return out.status === "blocked" ? [{ key: name, status: "fail" }] : [{ key: name, status: "ok" }];
  }
}
