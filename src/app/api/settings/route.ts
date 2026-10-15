import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/ledger";
import { decodeState, encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

// User-only settings. The agent has no tool that reaches this endpoint.
const Body = z.object({
  token: z.string(),
  language: z.enum(["en", "zh", "th", "vi", "id", "ja", "ko"]).optional(),
  agentMode: z.enum(["advisor", "copilot", "autopilot"]).optional(),
  autoApproveLimitUsd: z.number().min(0).max(500).optional(),
  perTxnLimitUsd: z.number().min(0).max(50_000).optional(),
  dailyLimitUsd: z.number().min(0).max(100_000).optional(),
});

export async function POST(req: Request) {
  if (rateLimited(req, "settings", 30)) return jsonError(429, "Too many requests");
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, "Invalid settings");
    const { token, language, ...settings } = parsed.data;
    const state = decodeState(token);
    const changes: string[] = [];
    if (language && language !== state.profile.language) {
      state.profile.language = language;
      changes.push(`language=${language}`);
    }
    for (const [k, v] of Object.entries(settings) as [keyof typeof state.settings, never][]) {
      if (v !== undefined && state.settings[k] !== v) {
        changes.push(`${k}: ${state.settings[k]} → ${v}`);
        state.settings[k] = v;
      }
    }
    if (changes.length) {
      const security = Object.keys(settings).some((k) => (settings as Record<string, unknown>)[k] !== undefined);
      audit(state, { actor: "user", action: "update_settings", tier: security ? "L3" : "L0", decision: "approved", detail: changes.join(", ") });
    }
    return NextResponse.json({ token: encodeState(state) });
  } catch (e) {
    return handleError(e);
  }
}
