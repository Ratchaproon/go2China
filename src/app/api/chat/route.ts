import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { expirePending } from "@/lib/actions";
import { runAgent } from "@/lib/agent";
import { decodeState, encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

export const maxDuration = 120;

const MAX_ATTACHMENT_B64 = 4_000_000; // ≈3 MB file

const Body = z.object({
  token: z.string(),
  message: z.string().max(4000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(8000) })).max(40),
  attachment: z.object({
    name: z.string().max(200),
    mediaType: z.enum(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]),
    data: z.string().max(MAX_ATTACHMENT_B64).regex(/^[A-Za-z0-9+/=]+$/),
  }).optional(),
});

export async function POST(req: Request) {
  if (rateLimited(req, "chat", 15)) return jsonError(429, "You're sending messages too quickly. Wait a moment and try again.");
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) {
    return jsonError(503, "The AI service is not configured: set ANTHROPIC_API_KEY on the server.");
  }
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, "Invalid request (file too large or unsupported type?)");
    const { token, message, history, attachment } = parsed.data;
    const state = decodeState(token);
    expirePending(state);

    // Stream newline-delimited JSON: one {"type":"step"} line per agent step as it happens,
    // then a final {"type":"done"} (or {"type":"error"}) line with the new signed state.
    const enc = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (obj: unknown) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
        try {
          const result = await runAgent(state, history, message, attachment, (step) => send({ type: "step", step }));
          send({ type: "done", token: encodeState(state), ...result });
        } catch (e) {
          send({ type: "error", message: agentErrorMessage(e) });
        } finally {
          controller.close();
        }
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
    });
  } catch (e) {
    return handleError(e);
  }
}

function agentErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return "The AI service is not configured (missing or invalid ANTHROPIC_API_KEY).";
  if (e instanceof Anthropic.RateLimitError) return "The AI service is busy. Please try again in a few seconds.";
  if (e instanceof Anthropic.APIConnectionError) return "Could not reach the AI service. Check the network connection.";
  if (e instanceof Anthropic.APIError) return `AI service error (${e.status ?? "unknown"}).`;
  console.error(e);
  return "Something went wrong. Please try again.";
}
