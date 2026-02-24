import type { ErrorRequestHandler, RequestHandler } from "express";

// ─── Request Logger ─────────────────────────────────────
// Logs every request with method, path, status code, and duration.
// Mutations (POST/PUT/PATCH/DELETE) log at info level; reads (GET) at debug.

export const requestLogger: RequestHandler = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const line = `${req.method} ${req.originalUrl} ${status} ${duration}ms`;

    if (status >= 500) {
      console.error(`[http] ${line}`);
    } else if (status >= 400) {
      console.warn(`[http] ${line}`);
    } else if (req.method === "GET") {
      console.debug(`[http] ${line}`);
    } else {
      console.log(`[http] ${line}`);
    }
  });

  next();
};

// ─── Error Handler ──────────────────────────────────────
// Catches any unhandled errors thrown from route handlers.
// Without this, Express silently drops errors or sends a bare 500.

export const errorHandler: ErrorRequestHandler = (err, req, _res, next) => {
  const message = err instanceof Error ? err.message : "Unknown error";
  const stack = err instanceof Error ? err.stack : undefined;
  console.error(`[error] ${req.method} ${req.originalUrl}: ${message}`);
  if (stack) console.error(`[error] ${stack}`);

  // Don't write to response if headers already sent (e.g. SSE mid-stream)
  if (_res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  _res.status(status).json({ error: message });
};
