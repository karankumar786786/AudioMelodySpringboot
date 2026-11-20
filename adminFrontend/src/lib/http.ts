import { adminFetch } from "./adminFetch";

/** An HTTP error from the admin backend, carrying the status and the server's message. */
export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

function messageFrom(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    for (const key of ["message", "error", "detail"]) {
      if (typeof b[key] === "string" && b[key]) return b[key] as string;
    }
  }
  return fallback;
}

async function parseBody(res: Response): Promise<unknown> {
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Message used when the server gives none. */
  errorMessage?: string;
}

/**
 * Calls the admin backend through `adminFetch` (HttpOnly cookie session, refresh on 401/403)
 * and returns the parsed JSON body, or throws an `ApiError`.
 */
export async function apiRequest<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, errorMessage } = options;
  const init: RequestInit = { method, signal };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await adminFetch(path, init);
  const data = await parseBody(res);
  if (!res.ok) {
    throw new ApiError(res.status, messageFrom(data, errorMessage ?? `Request failed (${res.status})`), data);
  }
  return data as T;
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { signal });

/** Builds `path?a=1&b=2`, dropping empty values. Every list view treats "ALL" as no filter. */
export function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** One page of a list endpoint, normalised from the backend's `format_paginated_response`. */
export interface Page<T> {
  rows: T[];
  total: number;
  page: number;
  size: number;
  meta: {
    totalCount?: number;
    activeCount?: number;
    blockedCount?: number;
    deletedCount?: number;
  };
}

export function toPage<T>(data: unknown, page: number, size: number): Page<T> {
  const d = (data ?? {}) as Record<string, any>;
  const rows: T[] = Array.isArray(d)
    ? (d as T[])
    : d.content ?? d.data?.content ?? (Array.isArray(d.data) ? d.data : []);
  const meta = d.paginationMetaData ?? d.data?.paginationMetaData ?? d.metadata ?? {};
  const metaTotal = Number(meta.totalCount ?? d.totalElements ?? d.totalCount);
  let total: number;
  if (Number.isFinite(metaTotal) && metaTotal >= 0 && !(metaTotal === 0 && rows.length > 0)) {
    total = metaTotal;
  } else if (rows.length < size) {
    total = page * size + rows.length;
  } else {
    // Unknown total and a full page: allow one more page.
    total = (page + 2) * size;
  }
  return { rows, total, page, size, meta };
}

/** Fetches one page of a list endpoint. */
export async function fetchPage<T>(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
  signal?: AbortSignal,
): Promise<Page<T>> {
  const page = Number(params.page ?? 0);
  const size = Number(params.size ?? 20);
  const data = await apiGet<unknown>(withQuery(path, params), signal);
  return toPage<T>(data, page, size);
}
