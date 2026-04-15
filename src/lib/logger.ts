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
