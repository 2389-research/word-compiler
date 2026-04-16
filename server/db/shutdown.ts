import type Database from "better-sqlite3";
import { createLogger } from "../lib/logger.js";

const logger = createLogger("db");

/** Minimal subset of http.Server that shutdown needs. */
interface Closeable {
  close(cb?: (err?: Error) => void): void;
}

/**
 * Wires SIGTERM and SIGINT to a graceful drain sequence:
 *
 *   1. Stop accepting new HTTP connections via `server.close()`.
 *      Existing in-flight requests get to finish.
 *   2. Close the SQLite database handle.
 *   3. Exit with code 0.
 *
 * The handler is idempotent: a second signal while a shutdown is already in
 * flight is ignored. If `server.close()` fails to drain within 10 seconds,
 * we log and force-exit with code 1.
 */
export function registerShutdownHandlers(server: Closeable, db: Database.Database): void {
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      logger.debug("shutdown already in progress; ignoring signal", { signal });
      return;
    }
    shuttingDown = true;
    logger.info("graceful shutdown starting", { signal });

    const forceExit = setTimeout(() => {
      logger.error("shutdown timed out after 10s; forcing exit");
      process.exit(1);
    }, 10_000);
    // Do not block the event loop on the timeout itself.
    if (typeof forceExit.unref === "function") forceExit.unref();

    await new Promise<void>((resolve) => {
      server.close((err) => {
        if (err) {
          logger.warn("server.close reported error", { error: err.message });
        } else {
          logger.info("http server closed");
        }
        resolve();
      });
    });

    try {
      db.close();
      logger.info("database closed");
    } catch (err) {
      logger.error("db.close failed", err instanceof Error ? err : new Error(String(err)));
    }

    clearTimeout(forceExit);
    process.exit(0);
  };

  process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.on("SIGINT", () => {
    void shutdown("SIGINT");
  });
}
