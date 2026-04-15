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
    ...(context ?? {}),
    timestamp: new Date().toISOString(),
    level,
    tag,
    message,
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

  const ctx: Record<string, unknown> | undefined = context instanceof Error ? errorFields(context) : context;

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
