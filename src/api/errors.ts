export type ApiErrorCode =
  | "NOT_FOUND"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "PAGE_EXPIRED"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL"
  | "UNKNOWN";

export interface ApiErrorInit {
  cause?: unknown;
  requestId?: string;
  body?: unknown;
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly requestId?: string;
  readonly body?: unknown;

  constructor(code: ApiErrorCode, message: string, status: number, init?: ApiErrorInit) {
    super(message, init?.cause !== undefined ? { cause: init.cause } : undefined);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.requestId = init?.requestId;
    this.body = init?.body;
  }
}
