import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { Page } from "@/lib/http";

export type Snapshot = Array<[QueryKey, unknown]>;

/**
 * Applies `update` to every cached page under `prefix` and returns a snapshot for rollback.
 * Cancels in-flight fetches first so a stale response cannot overwrite the optimistic state.
 */
export async function patchPages<T>(
  qc: QueryClient,
  prefix: QueryKey,
  update: (rows: T[]) => T[],
  totalDelta = 0,
): Promise<Snapshot> {
  await qc.cancelQueries({ queryKey: prefix });
  const snapshot = qc.getQueriesData({ queryKey: prefix });
  qc.setQueriesData<Page<T>>({ queryKey: prefix }, (old) => {
    if (!old || !Array.isArray(old.rows)) return old;
    return {
      ...old,
      rows: update(old.rows),
      total: Math.max(0, old.total + totalDelta),
    };
  });
  return snapshot;
}

export function restore(qc: QueryClient, snapshot: Snapshot | undefined): void {
  if (!snapshot) return;
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}
