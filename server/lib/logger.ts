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

function errorContext(err: Error): Record<string, unknown> {
  return {
    error: { name: err.name, message: err.message, stack: err.stack },
  };
}

// JSON.stringify can throw on circular refs or BigInt. Logging must never be
// a failure path for callers, so fall back to a marker payload on any error.
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown serialization error";
    return JSON.stringify({ serialization_error: reason });
  }
}

function formatPretty(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | undefined,
): string {
  const base = `[${tag}] ${level.toUpperCase()} ${message}`;
  if (!context || Object.keys(context).length === 0) return `${base}\n`;
  return `${base} ${safeStringify(context)}\n`;
}

function formatJson(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | undefined,
): string {
  const payload = {
    ...(context ?? {}),
    timestamp: new Date().toISOString(),
    level,
    tag,
    message,
  };
  return `${safeStringify(payload)}\n`;
}

function emit(
  level: LogLevel,
  tag: string,
  message: string,
  context: Record<string, unknown> | Error | undefined,
): void {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[resolveThreshold()]) return;

  const ctx: Record<string, unknown> | undefined = context instanceof Error ? errorContext(context) : context;

  const line = isProduction() ? formatJson(level, tag, message, ctx) : formatPretty(level, tag, message, ctx);

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
