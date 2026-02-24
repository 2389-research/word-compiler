import express from "express";
import supertest from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { errorHandler, requestLogger } from "../../server/middleware.js";

// ─── Helpers ────────────────────────────────────────────

/** Build a tiny Express app with the requestLogger and custom routes. */
function createLoggerApp(routes: (app: express.Express) => void): express.Express {
  const app = express();
  app.use(requestLogger);
  routes(app);
  return app;
}

/** Build a tiny Express app with the errorHandler and custom routes. */
function createErrorApp(routes: (app: express.Express) => void): express.Express {
  const app = express();
  routes(app);
  app.use(errorHandler);
  return app;
}

// ─── requestLogger ──────────────────────────────────────

describe("requestLogger", () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs GET 2xx at console.debug", async () => {
    const app = createLoggerApp((a) => {
      a.get("/items", (_req, res) => res.status(200).json({ ok: true }));
    });

    await supertest(app).get("/items").expect(200);

    expect(debugSpy).toHaveBeenCalledOnce();
    const msg = debugSpy.mock.calls[0]![0] as string;
    expect(msg).toContain("GET");
    expect(msg).toContain("/items");
    expect(msg).toContain("200");
  });

  it("logs non-GET 2xx (mutation) at console.log", async () => {
    const app = createLoggerApp((a) => {
      a.use(express.json());
      a.post("/items", (_req, res) => res.status(201).json({ id: 1 }));
    });

    await supertest(app).post("/items").send({ name: "x" }).expect(201);

    expect(logSpy).toHaveBeenCalledOnce();
    const msg = logSpy.mock.calls[0]![0] as string;
    expect(msg).toContain("POST");
    expect(msg).toContain("/items");
    expect(msg).toContain("201");
  });

  it("logs 4xx at console.warn", async () => {
    const app = createLoggerApp((a) => {
      a.get("/missing", (_req, res) => res.status(404).json({ error: "not found" }));
    });

    await supertest(app).get("/missing").expect(404);

    expect(warnSpy).toHaveBeenCalledOnce();
    const msg = warnSpy.mock.calls[0]![0] as string;
    expect(msg).toContain("GET");
    expect(msg).toContain("/missing");
    expect(msg).toContain("404");
  });

  it("logs 5xx at console.error", async () => {
    const app = createLoggerApp((a) => {
      a.get("/boom", (_req, res) => res.status(500).json({ error: "internal" }));
    });

    await supertest(app).get("/boom").expect(500);

    expect(errorSpy).toHaveBeenCalledOnce();
    const msg = errorSpy.mock.calls[0]![0] as string;
    expect(msg).toContain("GET");
    expect(msg).toContain("/boom");
    expect(msg).toContain("500");
  });

  it("includes duration (ms) in the log message", async () => {
    const app = createLoggerApp((a) => {
      a.get("/fast", (_req, res) => res.sendStatus(200));
    });

    await supertest(app).get("/fast").expect(200);

    expect(debugSpy).toHaveBeenCalledOnce();
    const msg = debugSpy.mock.calls[0]![0] as string;
    expect(msg).toMatch(/\d+ms/);
  });
});

// ─── errorHandler ───────────────────────────────────────

describe("errorHandler", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uses err.status when present", async () => {
    const app = createErrorApp((a) => {
      a.get("/bad", () => {
        const err: Error & { status?: number } = new Error("Bad request");
        err.status = 400;
        throw err;
      });
    });

    const res = await supertest(app).get("/bad");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: "Bad request" });
  });

  it("uses err.statusCode when err.status is absent", async () => {
    const app = createErrorApp((a) => {
      a.get("/conflict", () => {
        const err: Error & { statusCode?: number } = new Error("Conflict");
        err.statusCode = 409;
        throw err;
      });
    });

    const res = await supertest(app).get("/conflict");
    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: "Conflict" });
  });

  it("defaults to 500 for a plain Error", async () => {
    const app = createErrorApp((a) => {
      a.get("/plain", () => {
        throw new Error("Something broke");
      });
    });

    const res = await supertest(app).get("/plain");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Something broke" });
  });

  it("logs the error message and stack to console.error", async () => {
    const app = createErrorApp((a) => {
      a.get("/traced", () => {
        throw new Error("Traced error");
      });
    });

    await supertest(app).get("/traced");

    // First call: the message line; second call: the stack trace
    expect(errorSpy).toHaveBeenCalledTimes(2);
    expect(errorSpy.mock.calls[0]![0]).toContain("Traced error");
    expect(errorSpy.mock.calls[1]![0]).toContain("Traced error"); // stack includes the message
  });

  it("calls next(err) when headers are already sent", async () => {
    const nextSpy = vi.fn();

    const app = createErrorApp((a) => {
      a.get("/partial", (_req, res, next) => {
        // Write headers and body, then hand an error to the error handler
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.write("partial");
        res.end();
        // Now headers are sent — error handler should delegate to next(err)
        next(new Error("late error"));
      });
      // Insert a tracking middleware BEFORE the error handler to prove next(err) was called.
      // The errorHandler is added by createErrorApp after our routes.
    });

    // Add a final error handler that records the call
    app.use(((err: Error, _req, _res, next) => {
      nextSpy(err.message);
      next(err);
    }) as express.ErrorRequestHandler);

    const res = await supertest(app).get("/partial");
    // We got a response at all — server did not crash
    expect(res.status).toBe(200);
    // The error was forwarded via next(err) because headers were already sent
    expect(nextSpy).toHaveBeenCalledWith("late error");
  });

  it('returns "Unknown error" for non-Error throws', async () => {
    const app = createErrorApp((a) => {
      a.get("/weird", () => {
        throw "a string, not an Error"; // eslint-disable-line no-throw-literal
      });
    });

    const res = await supertest(app).get("/weird");
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Unknown error" });
  });
});
