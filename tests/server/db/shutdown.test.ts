import { EventEmitter } from "node:events";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerShutdownHandlers } from "../../../server/db/shutdown.js";

let sigintListeners: Array<(...args: unknown[]) => void>;
let sigtermListeners: Array<(...args: unknown[]) => void>;

beforeEach(() => {
  sigintListeners = [];
  sigtermListeners = [];
  vi.spyOn(process, "on").mockImplementation(((event: string, handler: (...args: unknown[]) => void) => {
    if (event === "SIGINT") sigintListeners.push(handler);
    if (event === "SIGTERM") sigtermListeners.push(handler);
    return process;
  }) as typeof process.on);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function makeFakeServer() {
  const emitter = new EventEmitter() as EventEmitter & {
    close: (cb: (err?: Error) => void) => void;
  };
  emitter.close = vi.fn((cb: (err?: Error) => void) => {
    // Simulate async drain completion
    setImmediate(() => cb());
  });
  return emitter;
}

describe("registerShutdownHandlers", () => {
  it("registers SIGINT and SIGTERM listeners", () => {
    const db = new Database(":memory:");
    const server = makeFakeServer();
    registerShutdownHandlers(server as unknown as Parameters<typeof registerShutdownHandlers>[0], db);

    expect(sigintListeners.length).toBe(1);
    expect(sigtermListeners.length).toBe(1);

    db.close();
  });

  it("on SIGTERM closes the HTTP server, closes the DB, and exits with code 0", async () => {
    const db = new Database(":memory:");
    const closeDbSpy = vi.spyOn(db, "close");
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => undefined) as never);

    const server = makeFakeServer();
    registerShutdownHandlers(server as unknown as Parameters<typeof registerShutdownHandlers>[0], db);

    const handler = sigtermListeners[0];
    expect(handler).toBeDefined();
    await handler!();
    // setImmediate in server.close() needs to drain.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect((server.close as unknown as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect(closeDbSpy).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it("shutdown is idempotent: second SIGTERM does not double-close the DB", async () => {
    const db = new Database(":memory:");
    const closeDbSpy = vi.spyOn(db, "close");
    vi.spyOn(process, "exit").mockImplementation(((_code?: number) => undefined) as never);

    const server = makeFakeServer();
    registerShutdownHandlers(server as unknown as Parameters<typeof registerShutdownHandlers>[0], db);

    const handler = sigtermListeners[0]!;
    await handler();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    await handler();
    await new Promise((resolve) => setImmediate(resolve));

    expect(closeDbSpy).toHaveBeenCalledTimes(1);
  });
});
