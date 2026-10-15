import { createHmac, timingSafeEqual } from "node:crypto";
import type { LedgerState } from "./ledger";

// The server is stateless: the sandbox ledger travels with the client as a
// signed token (base64url(JSON) + "." + HMAC-SHA256). The client can read it
// to render the UI but cannot forge balances, payees, settings or approvals.

const DEV_SECRET = "go2china-dev-only-secret-do-not-use-in-production";

function secret(): string {
  const s = process.env.LEDGER_SIGNING_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error("LEDGER_SIGNING_SECRET must be set (≥32 chars) in production");
  }
  return DEV_SECRET;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeState(state: LedgerState): string {
  const payload = Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export class InvalidTokenError extends Error {}

export function decodeState(token: unknown): LedgerState {
  if (typeof token !== "string" || token.length > 2_000_000) throw new InvalidTokenError("Missing or oversized state token");
  const dot = token.lastIndexOf(".");
  if (dot <= 0) throw new InvalidTokenError("Malformed state token");
  const payload = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1), "base64url");
  const expected = Buffer.from(sign(payload), "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new InvalidTokenError("State signature mismatch — the sandbox ledger was modified outside the server");
  }
  const state = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LedgerState;
  if (state.v !== 1) throw new InvalidTokenError("Unsupported state version");
  return state;
}
