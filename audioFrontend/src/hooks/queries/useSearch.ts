import { useQuery } from "@tanstack/react-query";
import { musicApi } from "@/lib/api";
import { queryKeys } from "./queryKeys";

export function useUnifiedSearch(query: string, options?: { enabled?: boolean }) {
  const trimmed = query.trim();
  return useQuery({
    queryKey: queryKeys.search.unified(trimmed),
    queryFn: () => musicApi.search.unified(trimmed),
    enabled: (options?.enabled ?? true) && trimmed.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });
}
