import type { Response } from "supertest";

/**
 * Envelope-agnostic body reader for route tests.
 *
 * Pre-envelope (current `main`): returns `res.body` as-is.
 * Post-envelope (Package B landed): unwraps `{ ok, data }` and throws on
 * `{ ok: false, error }`.
 *
 * Package B's author swaps the implementation in their PR; all
 * ~30+ call sites across Package E's new tests stay unchanged.
 */
export function unwrap<T>(res: Response): T {
  if (res.body && typeof res.body === "object" && "ok" in res.body) {
    if ((res.body as { ok: boolean }).ok === true) {
      return (res.body as { data: T }).data;
    }
    const err = (res.body as { error?: { code?: string; message?: string } }).error ?? {};
    throw new Error(`API error: ${err.code ?? "UNKNOWN"}: ${err.message ?? ""}`);
  }
  return res.body as T;
}
