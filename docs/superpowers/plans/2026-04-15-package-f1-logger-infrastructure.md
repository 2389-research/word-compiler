# Package F1: Logger Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a structured, level-gated logger for both the client (Vite/Svelte) and the Express server, as new files only, with zero call-site migrations — so that packages A, B, C, D, E can adopt it immediately when they land.

**Architecture:** Two self-contained modules (`src/lib/logger.ts` for the browser, `server/lib/logger.ts` for Node) exposing an identical `createLogger(tag)` factory returning a `Logger` with `debug/info/warn/error` methods. Level filtering is env-gated (`import.meta.env.VITE_LOG_LEVEL` on the client, `process.env.LOG_LEVEL` on the server). Server emits JSON in production and pretty lines in development; client always emits pretty lines via `console.*`. The interface is duplicated across the two files deliberately — they are ~40 lines each and a shared module would add cross-boundary import complexity for no real reuse.

**Tech Stack:** TypeScript strict, Vitest, Biome (2-space, 120 cols, double quotes, semicolons). No new dependencies.

**Part of:** [2026-04-15 P1 Parallel Cleanup Batch](../specs/2026-04-15-p1-parallel-batch-design.md)

---

## Scope boundary

This package may only create the following files:

- `src/lib/logger.ts`
- `server/lib/logger.ts`
- `tests/lib/logger.test.ts`
- `tests/server/lib/logger.test.ts`

It may NOT modify any existing file. No `console.*` call sites are migrated in this package — that is Package F2's job. The only goal here is to land the logger interface and make it importable.

---

## Shared design reference

Both logger files export the same shape. Keep it memorized — later tasks reuse it verbatim.

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown> | Error): void;
}

export function createLogger(tag: string): Logger;
```

Level ordering: `debug < info < warn < error`. A level threshold of `info` emits `info|warn|error` and drops `debug`. Default threshold is `info`.

When an `Error` is passed as the context to `.error(...)`, it must be serialized to `{ name, message, stack }` in the emitted payload.

---

## Task 1: Client logger (`src/lib/logger.ts`)

**Files:**
- Create: `src/lib/logger.ts`
- Test: `tests/lib/logger.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/logger.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test -- tests/lib/logger.test.ts`
Expected: all tests fail with a module-not-found error for `@/lib/logger`.

- [ ] **Step 3: Implement `src/lib/logger.ts`**

Create `src/lib/logger.ts`:

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown> | Error): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveThreshold(): LogLevel {
  const raw = (import.meta.env as Record<string, unknown>).VITE_LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function serializeError(err: Error): Record<string, unknown> {
  return { name: err.name, message: err.message, stack: err.stack };
}

function emit(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | Error | undefined,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[resolveThreshold()]) return;

  const line = `[${tag}] ${message}`;
  const payload = context instanceof Error ? serializeError(context) : context;

  const sink = console[level].bind(console);
  if (payload === undefined) {
    sink(line);
  } else {
    sink(line, payload);
  }
}

export function createLogger(tag: string): Logger {
  return {
    debug: (message, context) => emit("debug", tag, message, context),
    info: (message, context) => emit("info", tag, message, context),
    warn: (message, context) => emit("warn", tag, message, context),
    error: (message, context) => emit("error", tag, message, context),
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test -- tests/lib/logger.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Run the typechecker**

Run: `pnpm typecheck`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/lib/logger.ts tests/lib/logger.test.ts
git commit -m "$(cat <<'EOF'
feat(logger): add client-side structured logger

Introduces src/lib/logger.ts with a createLogger(tag) factory
returning a level-gated Logger. Reads threshold from
VITE_LOG_LEVEL, defaults to info. Serializes Error instances
passed as error context. No call-site migrations in this commit.

Part of #19 (F1 infrastructure half).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server logger (`server/lib/logger.ts`)

**Files:**
- Create: `server/lib/logger.ts`
- Test: `tests/server/lib/logger.test.ts`

Design note: the server logger emits **JSON** when `NODE_ENV === "production"` and **pretty single-line** output otherwise. Both formats go through `process.stdout` for debug/info and `process.stderr` for warn/error — NOT through `console.*` — so that the future `console.*` sweep in F2 cannot accidentally recurse into the logger.

- [ ] **Step 1: Write the failing tests**

Create `tests/server/lib/logger.test.ts`:

```ts
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
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

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

  it("emits pretty single-line output in development", () => {
    setEnv("debug", "development");
    const log = createLogger("db");
    log.info("hello", { rows: 3 });
    const line = (stdoutSpy.mock.calls[0]?.[0] as string).trim();
    expect(line).toContain("[db]");
    expect(line).toContain("hello");
    expect(line).toContain("rows");
    expect(line).toContain("3");
    expect(line.endsWith("\n") || line.length > 0).toBe(true);
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

  it("serializes an Error passed to .error into name/message/stack", () => {
    setEnv("debug", "production");
    const log = createLogger("db");
    log.error("failed", new Error("boom"));
    const raw = stderrSpy.mock.calls[0]?.[0] as string;
    const parsed = JSON.parse(raw.trim());
    expect(parsed.name).toBe("Error");
    expect(parsed.message).toBe("failed");
    expect(parsed.error_name).toBe("Error");
    expect(parsed.error_message).toBe("boom");
    expect(typeof parsed.error_stack).toBe("string");
  });
});
```

Note on the `Error` test: the JSON payload uses `error_name`/`error_message`/`error_stack` to keep the outer `message` field stable (equal to the log call's `message` argument) while still carrying the error details. This matters for log aggregators that key on `message`.

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm test -- tests/server/lib/logger.test.ts`
Expected: all tests fail with a module-not-found error.

- [ ] **Step 3: Implement `server/lib/logger.ts`**

Create `server/lib/logger.ts`:

```ts
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, context?: Record<string, unknown> | Error): void;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function resolveThreshold(): LogLevel {
  const raw = process.env.LOG_LEVEL;
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function errorFields(err: Error): Record<string, unknown> {
  return {
    error_name: err.name,
    error_message: err.message,
    error_stack: err.stack,
  };
}

function formatPretty(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | undefined,
): string {
  const base = `[${tag}] ${level.toUpperCase()} ${message}`;
  if (!context || Object.keys(context).length === 0) return `${base}\n`;
  return `${base} ${JSON.stringify(context)}\n`;
}

function formatJson(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | undefined,
): string {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    tag,
    message,
    ...(context ?? {}),
  };
  return `${JSON.stringify(payload)}\n`;
}

function emit(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | Error | undefined,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[resolveThreshold()]) return;

  const ctx: Record<string, unknown> | undefined =
    context instanceof Error ? errorFields(context) : context;

  const line = isProduction()
    ? formatJson(level, tag, message, ctx)
    : formatPretty(level, tag, message, ctx);

  const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
  stream.write(line);
}

export function createLogger(tag: string): Logger {
  return {
    debug: (message, context) => emit("debug", tag, message, context),
    info: (message, context) => emit("info", tag, message, context),
    warn: (message, context) => emit("warn", tag, message, context),
    error: (message, context) => emit("error", tag, message, context),
  };
}
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `pnpm test -- tests/server/lib/logger.test.ts`
Expected: 6 tests pass.

- [ ] **Step 5: Run the full test suite and typechecker**

Run: `pnpm check-all`
Expected: lint, typecheck, and full vitest suite all green.

- [ ] **Step 6: Commit**

```bash
git add server/lib/logger.ts tests/server/lib/logger.test.ts
git commit -m "$(cat <<'EOF'
feat(logger): add server-side structured logger

Introduces server/lib/logger.ts with a createLogger(tag) factory.
Reads threshold from LOG_LEVEL (default info). Emits pretty lines
in development and JSON in production. Writes to process.stdout
for debug/info and process.stderr for warn/error — deliberately
bypassing console.* so the F2 console.* sweep cannot recurse.
Errors passed as context are serialized into error_name /
error_message / error_stack fields.

Part of #19 (F1 infrastructure half).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Open PR

- [ ] **Step 1: Push branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "feat(logger): F1 logger infrastructure (#19)" --body "$(cat <<'EOF'
## Summary
- Introduces `src/lib/logger.ts` and `server/lib/logger.ts` — level-gated structured loggers for client and server.
- Zero call-site migrations. No existing file is modified.
- Unblocks packages A–E in the p1 parallel batch so they can use the logger for any new log lines.

Part of #19. Package F1 of the [p1 parallel batch spec](../blob/main/docs/superpowers/specs/2026-04-15-p1-parallel-batch-design.md).

## Test plan
- [ ] `pnpm check-all` green
- [ ] `tests/lib/logger.test.ts` — 6 tests pass
- [ ] `tests/server/lib/logger.test.ts` — 6 tests pass

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Done criteria

- Both logger files exist and are importable.
- Both test files pass.
- `pnpm check-all` green on the branch.
- PR open against main.
- No file other than the four listed in "Scope boundary" is touched.
