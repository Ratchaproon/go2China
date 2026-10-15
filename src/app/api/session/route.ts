import { NextResponse } from "next/server";
import { z } from "zod";
import { COUNTRIES } from "@/lib/countries";
import { createInitialState } from "@/lib/ledger";
import { encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

const codes = COUNTRIES.map((c) => c.code) as [string, ...string[]];

const Body = z.object({
  name: z.string().trim().max(60).default(""),
  homeCountry: z.enum(codes),
  destCountry: z.enum(codes),
  language: z.enum(["en", "zh", "th", "vi", "id", "ja", "ko"]),
  university: z.string().trim().max(120).default(""),
  studentId: z.string().trim().max(30).default(""),
  studentType: z.enum(["degree", "exchange"]).default("degree"),
  stayMonths: z.number().int().min(1).max(72).default(12),
});

export async function POST(req: Request) {
  if (rateLimited(req, "session", 20)) return jsonError(429, "Too many requests");
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, "Invalid profile");
    const p = parsed.data;
    if (p.homeCountry === p.destCountry) return jsonError(400, "Home and destination must differ");
    const state = createInitialState({ ...p, studentId: p.studentId || `S${Math.floor(10_000_000 + Math.random() * 89_999_999)}` });
    return NextResponse.json({ token: encodeState(state) });
  } catch (e) {
    return handleError(e);
  }
}
