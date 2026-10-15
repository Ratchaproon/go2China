import { describe, expect, it } from "vitest";
import { decodeState, encodeState, InvalidTokenError } from "@/lib/token";
import { freshState } from "./helpers";

describe("signed state token", () => {
  it("round-trips", () => {
    const s = freshState();
    expect(decodeState(encodeState(s))).toEqual(s);
  });

  it("rejects a tampered balance", () => {
    const s = freshState();
    const token = encodeState(s);
    const [payload, sig] = token.split(".");
    const forged = JSON.parse(Buffer.from(payload, "base64url").toString());
    forged.accounts[0].balance = 99_999_999;
    const forgedToken = `${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`;
    expect(() => decodeState(forgedToken)).toThrow(InvalidTokenError);
  });

  it("rejects garbage", () => {
    expect(() => decodeState("nope")).toThrow(InvalidTokenError);
    expect(() => decodeState(42)).toThrow(InvalidTokenError);
  });
});
