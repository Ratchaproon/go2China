import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/ledger";
import { ALL_STEP_IDS } from "@/lib/paperwork";
import { decodeState, encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

// The student ticks paperwork steps off. Progress tracking only: no documents are stored.
const Body = z.object({ token: z.string(), stepId: z.string().max(60), done: z.boolean() });

export async function POST(req: Request) {
  if (rateLimited(req, "paperwork", 60)) return jsonError(429, "Too many requests");
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success || !ALL_STEP_IDS.has(parsed.data.stepId)) return jsonError(400, "Invalid request");
    const { token, stepId, done } = parsed.data;
    const state = decodeState(token);
    state.paperwork = { ...(state.paperwork ?? {}), [stepId]: done };
    audit(state, { actor: "user", action: "paperwork_progress", tier: "L0", decision: "approved", detail: `${stepId} → ${done ? "done" : "to do"}` });
    return NextResponse.json({ token: encodeState(state) });
  } catch (e) {
    return handleError(e);
  }
}
