import { describe, expect, it } from "vitest";
import { type ApiErrorCode, err, ok, okList, statusFor } from "../../../server/api/envelope.js";

describe("envelope helpers", () => {
  it("ok() wraps data in { ok: true, data }", () => {
    expect(ok({ x: 1 })).toEqual({ ok: true, data: { x: 1 } });
  });

  it("okList() wraps data + nextPageToken", () => {
    expect(okList([1, 2], null)).toEqual({ ok: true, data: [1, 2], nextPageToken: null });
    expect(okList([1, 2], "tok")).toEqual({ ok: true, data: [1, 2], nextPageToken: "tok" });
  });

  it("err() wraps code and message in { ok: false, error }", () => {
    const code: ApiErrorCode = "NOT_FOUND";
    expect(err(code, "nope")).toEqual({
      ok: false,
      error: { code: "NOT_FOUND", message: "nope" },
    });
  });

  it("statusFor maps every known code to an HTTP status", () => {
    expect(statusFor("NOT_FOUND")).toBe(404);
    expect(statusFor("BAD_REQUEST")).toBe(400);
    expect(statusFor("CONFLICT")).toBe(409);
    expect(statusFor("PAGE_EXPIRED")).toBe(400);
    expect(statusFor("UPSTREAM_UNAVAILABLE")).toBe(502);
    expect(statusFor("INTERNAL")).toBe(500);
  });
});
