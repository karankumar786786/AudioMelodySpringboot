import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/http";

const MAX_QUERY_RETRIES = 2;

/** Retry network failures and 5xx/429; never retry other 4xx (auth, validation, not found). */
export function shouldRetry(
  failureCount: number,
  error: unknown,
  max = MAX_QUERY_RETRIES,
): boolean {
  if (failureCount >= max) return false;
  if (error instanceof ApiError)
    return error.status >= 500 || error.status === 429;
  return true;
}

/** For idempotent mutations (PUT/DELETE/toggles): one retry on network errors or 5xx. */
export const retryIdempotent = (failureCount: number, error: Error) =>
  shouldRetry(failureCount, error, 1);

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetry,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
        // Every request renews the admin session in Redis, which is billed per command,
        // so screens refetch on focus only when they opt in (the jobs monitor does).
        refetchOnWindowFocus: false,
      },
      mutations: {
        // Creating things is not idempotent; hooks opt in with `retryIdempotent`.
        retry: false,
      },
    },
  });
}

declare module "@tanstack/react-query" {
  interface Register {
    defaultError: Error;
  }
}
