import { NextResponse } from "next/server";
import { InvalidTokenError } from "./token";

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(e: unknown) {
  if (e instanceof InvalidTokenError) return jsonError(401, e.message);
  console.error(e);
  return jsonError(500, "Something went wrong. Please try again.");
}

// Best-effort per-instance rate limiter (sliding window). A production
// deployment would use a shared store; see SECURITY.md.
const hits = new Map<string, number[]>();

export function rateLimited(req: Request, key: string, limit: number, windowMs = 60_000): boolean {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(id, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > limit;
}
