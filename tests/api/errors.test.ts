import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/errors";

describe("ApiError", () => {
  it("carries code, message, and status", () => {
    const e = new ApiError("NOT_FOUND", "missing", 404);
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("missing");
    expect(e.status).toBe(404);
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe("ApiError");
  });

  it("accepts optional cause, requestId, and body", () => {
    const rootCause = new Error("boom");
    const e = new ApiError("UNKNOWN", "wrap", 500, {
      cause: rootCause,
      requestId: "req-123",
      body: { garbage: true },
    });
    expect(e.cause).toBe(rootCause);
    expect(e.requestId).toBe("req-123");
    expect(e.body).toEqual({ garbage: true });
  });

  it("is throwable and catchable as a standard Error", () => {
    try {
      throw new ApiError("INTERNAL", "boom", 500);
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toBeInstanceOf(Error);
    }
  });
});
