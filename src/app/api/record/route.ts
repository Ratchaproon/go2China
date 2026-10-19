import { NextResponse } from "next/server";
import { z } from "zod";
import { expirePending } from "@/lib/actions";
import { isCurrency } from "@/lib/countries";
import { SPEND_CATEGORIES, type Category, deleteEntry, recordEntry } from "@/lib/ledger";
import { decodeState, encodeState } from "@/lib/token";
import { handleError, jsonError, rateLimited } from "@/lib/http";

// Log income or spending (or delete a logged entry) from the Wallet form. No AI
// call, so it's instant and free; the agent's record_money tool uses the same rules.
const Body = z.union([
  z.object({
    token: z.string(),
    type: z.enum(["expense", "income"]),
    amount: z.number().positive().max(100_000_000),
    currency: z.string().refine(isCurrency),
    category: z.enum(SPEND_CATEGORIES as [Category, ...Category[]]).optional(),
    note: z.string().max(80).default(""),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  z.object({ token: z.string(), deleteId: z.string().max(64) }),
]);

export async function POST(req: Request) {
  if (rateLimited(req, "record", 60)) return jsonError(429, "Too many requests");
  try {
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return jsonError(400, "Check the amount, category and date.");
    const state = decodeState(parsed.data.token);
    expirePending(state);
    if ("deleteId" in parsed.data) {
      if (!deleteEntry(state, parsed.data.deleteId)) return jsonError(404, "Only entries you logged yourself can be deleted.");
    } else {
      const { type, amount, currency, category, note, date } = parsed.data;
      const r = recordEntry(state, { type, amount, currency: currency as never, category, note, date }, "form");
      if (!r.ok) return jsonError(400, r.message);
    }
    return NextResponse.json({ token: encodeState(state) });
  } catch (e) {
    return handleError(e);
  }
}
