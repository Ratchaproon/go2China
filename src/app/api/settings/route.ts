import { NextResponse } from "next/server";
import { z } from "zod";
import { expirePending } from "@/lib/actions";
import { HARD_MAX, LIMIT_KEYS, applySettingsChange, cancelScheduled } from "@/lib/limits";
import { decodeState, encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

// User-only settings. The agent has no tool that reaches this endpoint.
// Language is a display preference and isn't written to the security audit log.
const Body = z.object({
  token: z.string(),
  language: z.enum(["en", "zh", "th", "vi", "id", "ja", "ko"]).optional(),
  agentMode: z.enum(["advisor", "copilot", "autopilot"]).optional(),
  autoApproveLimitUsd: z.number().min(0).max(HARD_MAX.autoApproveLimitUsd).optional(),
  perTxnLimitUsd: z.number().min(0).max(HARD_MAX.perTxnLimitUsd).optional(),
  dailyLimitUsd: z.number().min(0).max(HARD_MAX.dailyLimitUsd).optional(),
  pin: z.string().max(12).optional(),
  cancel: z.enum(["perTxnLimitUsd", "dailyLimitUsd", "autoApproveLimitUsd"]).optional(),
});

export async function POST(req: Request) {
  if (rateLimited(req, "settings", 30)) return jsonError(429, "Too many requests");
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, "Limits can't be higher than USD 5,000 per payment, USD 10,000 per day or USD 500 for Autopilot.");
    const { token, language, agentMode, pin, cancel, ...rest } = parsed.data;
    const state = decodeState(token);
    expirePending(state);
    if (language) state.profile.language = language;
    if (cancel) cancelScheduled(state, cancel);
    const limits = Object.fromEntries(LIMIT_KEYS.filter((k) => rest[k] != null).map((k) => [k, rest[k]]));
    const result = applySettingsChange(state, { agentMode, limits, pin });
    if (!result.ok) return NextResponse.json({ error: result.message, code: result.error }, { status: 400 });
    return NextResponse.json({ token: encodeState(state), applied: result.applied, scheduled: result.scheduled });
  } catch (e) {
    return handleError(e);
  }
}
