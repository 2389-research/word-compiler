export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "PAGE_EXPIRED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL";

export type ApiOk<T> = { ok: true; data: T };
export type ApiErr = { ok: false; error: { code: ApiErrorCode; message: string } };
export type ApiResponse<T> = ApiOk<T> | ApiErr;
export type ApiListResponse<T> = { ok: true; data: T[]; nextPageToken: string | null };

export function ok<T>(data: T): ApiOk<T> {
  return { ok: true, data };
}

export function okList<T>(data: T[], nextPageToken: string | null): ApiListResponse<T> {
  return { ok: true, data, nextPageToken };
}

export function err(code: ApiErrorCode, message: string): ApiErr {
  return { ok: false, error: { code, message } };
}

export function statusFor(code: ApiErrorCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "BAD_REQUEST":
      return 400;
    case "CONFLICT":
      return 409;
    case "PAGE_EXPIRED":
      return 400;
    case "UPSTREAM_UNAVAILABLE":
      return 502;
    case "INTERNAL":
      return 500;
  }
}
