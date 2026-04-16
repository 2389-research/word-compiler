// In-memory page-based pagination with opaque tokens.
//
// This module deliberately does NOT implement cursor pagination. The token
// encodes { offset, total }. It is opaque to clients, so a future
// repository-level seek-based rewrite can swap the implementation without
// client changes.
//
// The `total` field enables weak expired-page detection: if the result set
// size changes between page fetches, we surface PAGE_EXPIRED. This is a
// weak guard -- equal-and-opposite mutations (one insert + one delete) net
// out to the same total and slip past. Do not rely on it for consistency.

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

export interface DecodedPageToken {
  offset: number;
  total: number;
}

export interface ParsedListQuery {
  limit: number;
  token: DecodedPageToken | null;
}

export interface PaginateInput {
  limit: number;
  token: DecodedPageToken | null;
}

export interface PaginatedResult<T> {
  data: T[];
  nextPageToken: string | null;
}

export class PageExpiredError extends Error {
  constructor(message = "Page expired; result set changed, refetch from page 1") {
    super(message);
    this.name = "PageExpiredError";
  }
}

export function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === "") return DEFAULT_LIMIT;
  const s = String(raw);
  if (!/^-?\d+$/.test(s)) {
    throw new Error("Invalid limit");
  }
  const n = Number(s);
  if (!Number.isFinite(n) || n < 1) {
    throw new Error("Invalid limit");
  }
  if (n > MAX_LIMIT) return MAX_LIMIT;
  return n;
}

export function encodePageToken(token: DecodedPageToken): string {
  return Buffer.from(JSON.stringify(token), "utf8").toString("base64url");
}

export function decodePageToken(token: string | null | undefined): DecodedPageToken | null {
  if (token === null || token === undefined || token === "") return null;
  let raw: string;
  try {
    raw = Buffer.from(token, "base64url").toString("utf8");
  } catch {
    throw new Error("Invalid page token");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Invalid page token");
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { offset?: unknown }).offset !== "number" ||
    typeof (parsed as { total?: unknown }).total !== "number"
  ) {
    throw new Error("Invalid page token");
  }
  const { offset, total } = parsed as DecodedPageToken;
  if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(total) || total < 0) {
    throw new Error("Invalid page token");
  }
  return { offset, total };
}

export function parseListQuery(query: Record<string, unknown>): ParsedListQuery {
  return {
    limit: parseLimit(query.limit),
    token: decodePageToken(query.pageToken as string | null | undefined),
  };
}

export function paginate<T>(rows: readonly T[], input: PaginateInput): PaginatedResult<T> {
  const total = rows.length;
  let offset = 0;

  if (input.token) {
    if (input.token.total !== total) {
      throw new PageExpiredError();
    }
    offset = input.token.offset;
  }

  const end = Math.min(offset + input.limit, total);
  const data = rows.slice(offset, end) as T[];
  const nextOffset = end;
  const nextPageToken = nextOffset >= total ? null : encodePageToken({ offset: nextOffset, total });
  return { data, nextPageToken };
}
