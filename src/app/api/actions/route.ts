import { NextResponse } from "next/server";
import { z } from "zod";
import { decide } from "@/lib/actions";
import { decodeState, encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

const Body = z.object({ token: z.string(), actionId: z.string().max(64), approve: z.boolean() });

// Approve or reject a pending agent proposal. This is the only path that moves money.
export async function POST(req: Request) {
  if (rateLimited(req, "actions", 30)) return jsonError(429, "Too many requests");
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, "Invalid request");
    const state = decodeState(parsed.data.token);
    const outcome = decide(state, parsed.data.actionId, parsed.data.approve);
    return NextResponse.json({ token: encodeState(state), outcome });
  } catch (e) {
    return handleError(e);
  }
}
