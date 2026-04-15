import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createLogger, type LogLevel } from "../../../server/lib/logger";

const originalLevel = process.env.LOG_LEVEL;
const originalNodeEnv = process.env.NODE_ENV;

function setEnv(level: LogLevel | undefined, nodeEnv: string | undefined) {
  if (level === undefined) delete process.env.LOG_LEVEL;
  else process.env.LOG_LEVEL = level;
  if (nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = nodeEnv;
}

describe("createLogger (server)", () => {
  // biome-ignore lint/suspicious/noExplicitAny: spyOn on overloaded process.stdout.write signature
  let stdoutSpy: any;
  // biome-ignore lint/suspicious/noExplicitAny: spyOn on overloaded process.stderr.write signature
  let stderrSpy: any;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setEnv(originalLevel as LogLevel | undefined, originalNodeEnv);
  });

  it("writes info/debug to stdout and warn/error to stderr", () => {
    setEnv("debug", "development");
    const log = createLogger("db");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(stdoutSpy).toHaveBeenCalledTimes(2);
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it("filters messages below the configured level", () => {
    setEnv("warn", "development");
    const log = createLogger("db");
    log.debug("d");
    log.info("i");
    log.warn("w");
    log.error("e");
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledTimes(2);
  });

  it("defaults to info when LOG_LEVEL is unset", () => {
    setEnv(undefined, "development");
    const log = createLogger("db");
    log.debug("d");
    log.info("i");
    expect(stdoutSpy).toHaveBeenCalledTimes(1);
  });

  it("emits pretty single-line output in development with trailing newline", () => {
    setEnv("debug", "development");
    const log = createLogger("db");
    log.info("hello", { rows: 3 });
    const raw = stdoutSpy.mock.calls[0]?.[0] as string;
    expect(raw.endsWith("\n")).toBe(true);
    // Single-line contract: no embedded newlines before the terminating one.
    expect(raw.slice(0, -1)).not.toContain("\n");
    const line = raw.trim();
    expect(line).toContain("[db]");
    expect(line).toContain("hello");
    expect(line).toContain("rows");
    expect(line).toContain("3");
  });

  it("lets the envelope message/level/tag win over colliding context keys in JSON output", () => {
    setEnv("debug", "production");
    const log = createLogger("real-tag");
    log.info("real message", {
      message: "user supplied",
      level: "trace",
      tag: "spoofed",
      timestamp: "fake",
      other: 1,
    });
    const raw = stdoutSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed.message).toBe("real message");
    expect(parsed.level).toBe("info");
    expect(parsed.tag).toBe("real-tag");
    expect(parsed.timestamp).not.toBe("fake");
    expect(parsed.other).toBe(1);
  });

  it("emits JSON output in production", () => {
    setEnv("debug", "production");
    const log = createLogger("db");
    log.info("hello", { rows: 3 });
    const raw = stdoutSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed.level).toBe("info");
    expect(parsed.tag).toBe("db");
    expect(parsed.message).toBe("hello");
    expect(parsed.rows).toBe(3);
    expect(typeof parsed.timestamp).toBe("string");
  });

  it("serializes an Error passed to .error as a nested error object", () => {
    setEnv("debug", "production");
    const log = createLogger("db");
    log.error("failed", new Error("boom"));
    const raw = stderrSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed.message).toBe("failed");
    expect(parsed.error.name).toBe("Error");
    expect(parsed.error.message).toBe("boom");
    expect(typeof parsed.error.stack).toBe("string");
  });

  it("does not throw when context contains circular references", () => {
    setEnv("debug", "production");
    const log = createLogger("db");
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    expect(() => log.info("cycle", circular)).not.toThrow();
    const raw = stdoutSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed.serialization_error).toBeDefined();
    expect(typeof parsed.serialization_error).toBe("string");
  });

  it("does not throw when context contains a BigInt", () => {
    setEnv("debug", "development");
    const log = createLogger("db");
    expect(() => log.info("bignum", { n: 10n })).not.toThrow();
    const raw = stdoutSpy.mock.calls[0]?.[0] as string;
    // Falls back to the serialization_error marker; must still write a single newline-terminated line.
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw).toContain("serialization_error");
  });
});
