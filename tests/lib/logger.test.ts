import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, type LogLevel } from "@/lib/logger";

// The client logger reads import.meta.env.VITE_LOG_LEVEL.
// Vitest exposes import.meta.env as a mutable object, so each test
// sets the level it wants and restores afterwards.
const originalLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined;

describe("createLogger (client)", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = originalLevel;
  });

  it("prefixes every message with the tag in square brackets", () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = "debug";
    const log = createLogger("compiler");
    log.info("hello");
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy.mock.calls[0]?.[0]).toContain("[compiler]");
    expect(infoSpy.mock.calls[0]?.[0]).toContain("hello");
  });

  it("filters messages below the configured level", () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = "warn";
    const log = createLogger("x");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("defaults to info when VITE_LOG_LEVEL is unset", () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = undefined;
    const log = createLogger("x");
    log.debug("d");
    log.info("i");
    expect(debugSpy).not.toHaveBeenCalled();
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("passes context as a second argument to console.*", () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = "debug";
    const log = createLogger("x");
    log.info("msg", { userId: 42 });
    expect(infoSpy.mock.calls[0]?.[1]).toEqual({ userId: 42 });
  });

  it("serializes an Error passed to .error into name/message/stack", () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = "debug";
    const log = createLogger("x");
    const err = new Error("boom");
    log.error("failed", err);
    const ctx = errorSpy.mock.calls[0]?.[1] as { name: string; message: string; stack?: string };
    expect(ctx.name).toBe("Error");
    expect(ctx.message).toBe("boom");
    expect(typeof ctx.stack).toBe("string");
  });

  it("omits the context argument entirely when none is provided", () => {
    (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL = "debug";
    const log = createLogger("x");
    log.info("bare");
    expect(infoSpy.mock.calls[0]?.length).toBe(1);
  });
});
