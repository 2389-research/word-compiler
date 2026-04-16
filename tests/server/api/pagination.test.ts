import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIMIT,
  decodePageToken,
  encodePageToken,
  MAX_LIMIT,
  paginate,
  parseLimit,
  parseListQuery,
} from "../../../server/api/pagination.js";

describe("parseLimit", () => {
  it("returns DEFAULT when missing or empty", () => {
    expect(parseLimit(undefined)).toBe(DEFAULT_LIMIT);
    expect(parseLimit("")).toBe(DEFAULT_LIMIT);
  });

  it("rejects non-numeric", () => {
    expect(() => parseLimit("abc")).toThrow(/invalid limit/i);
  });

  it("rejects zero and negative", () => {
    expect(() => parseLimit("0")).toThrow(/invalid limit/i);
    expect(() => parseLimit("-5")).toThrow(/invalid limit/i);
  });

  it("rejects non-integer", () => {
    expect(() => parseLimit("1.5")).toThrow(/invalid limit/i);
  });

  it("caps at MAX_LIMIT", () => {
    expect(parseLimit("10000")).toBe(MAX_LIMIT);
  });

  it("passes through valid limits", () => {
    expect(parseLimit("25")).toBe(25);
  });
});

describe("encodePageToken / decodePageToken", () => {
  it("roundtrips { offset, total }", () => {
    const tok = encodePageToken({ offset: 10, total: 42 });
    expect(decodePageToken(tok)).toEqual({ offset: 10, total: 42 });
  });

  it("decodePageToken returns null for null/undefined/empty", () => {
    expect(decodePageToken(null)).toBeNull();
    expect(decodePageToken(undefined)).toBeNull();
    expect(decodePageToken("")).toBeNull();
  });

  it("throws on malformed base64", () => {
    expect(() => decodePageToken("!!!not-base64!!!")).toThrow(/invalid page token/i);
  });

  it("throws on valid base64 non-JSON", () => {
    const bad = Buffer.from("not json").toString("base64url");
    expect(() => decodePageToken(bad)).toThrow(/invalid page token/i);
  });

  it("throws on JSON missing offset/total", () => {
    const bad = Buffer.from(JSON.stringify({ foo: 1 })).toString("base64url");
    expect(() => decodePageToken(bad)).toThrow(/invalid page token/i);
  });
});

describe("paginate", () => {
  const rows = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];

  it("returns first page and nextPageToken when more rows exist", () => {
    const page = paginate(rows, { limit: 2, token: null });
    expect(page.data).toEqual([{ id: "a" }, { id: "b" }]);
    expect(page.nextPageToken).toBe(encodePageToken({ offset: 2, total: 5 }));
  });

  it("returns mid page starting at token offset", () => {
    const page = paginate(rows, { limit: 2, token: { offset: 2, total: 5 } });
    expect(page.data).toEqual([{ id: "c" }, { id: "d" }]);
    expect(page.nextPageToken).toBe(encodePageToken({ offset: 4, total: 5 }));
  });

  it("returns last page with nextPageToken = null", () => {
    const page = paginate(rows, { limit: 10, token: { offset: 0, total: 5 } });
    expect(page.data).toEqual(rows);
    expect(page.nextPageToken).toBeNull();
  });

  it("throws PAGE_EXPIRED when token.total differs from current total", () => {
    expect(() => paginate(rows, { limit: 2, token: { offset: 2, total: 999 } })).toThrow(/page expired/i);
  });

  it("returns empty data when offset is past end (not expired, just past)", () => {
    const page = paginate(rows, { limit: 10, token: { offset: 5, total: 5 } });
    expect(page.data).toEqual([]);
    expect(page.nextPageToken).toBeNull();
  });
});

describe("parseListQuery", () => {
  it("returns parsed limit and decoded token", () => {
    const tok = encodePageToken({ offset: 3, total: 10 });
    const parsed = parseListQuery({ limit: "10", pageToken: tok });
    expect(parsed.limit).toBe(10);
    expect(parsed.token).toEqual({ offset: 3, total: 10 });
  });

  it("returns DEFAULT limit and null token for empty query", () => {
    const parsed = parseListQuery({});
    expect(parsed.limit).toBe(DEFAULT_LIMIT);
    expect(parsed.token).toBeNull();
  });

  it("throws BAD_REQUEST-shaped for malformed token", () => {
    expect(() => parseListQuery({ pageToken: "!!!" })).toThrow(/invalid page token/i);
  });

  it("throws BAD_REQUEST-shaped for invalid limit", () => {
    expect(() => parseListQuery({ limit: "abc" })).toThrow(/invalid limit/i);
  });
});
