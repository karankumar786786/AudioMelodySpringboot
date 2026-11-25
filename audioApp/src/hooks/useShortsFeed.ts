import { InfiniteData, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Short, ShortSort, ShortsPage, shortsService } from "@/service/shortsService";

export type ShortsSource =
  | { kind: "feed"; sort?: ShortSort }
  | { kind: "song"; songId: string }
  | { kind: "mine" }
  | { kind: "liked" };

export const shortsKey = (source: ShortsSource) => ["shorts", source] as const;

function fetchPage(source: ShortsSource, cursor: string | null): Promise<ShortsPage> {
  switch (source.kind) {
    case "song":
      return shortsService.bySong(source.songId, cursor);
    case "mine":
      return shortsService.mine(cursor);
    case "liked":
      return shortsService.liked(cursor);
    default:
      return shortsService.feed({ sort: source.sort ?? "foryou", cursor });
  }
}

/** Pure: a short with the like toggled. Never lets the count go below zero. */
export function applyLike(short: Short, liked: boolean, serverCount?: number): Short {
  const count = serverCount ?? Math.max(0, short.likesCount + (liked === short.liked ? 0 : liked ? 1 : -1));
  return { ...short, liked, likesCount: count };
}

/** Pure: every cached page with one short replaced. */
export function patchShortInPages(
  data: InfiniteData<ShortsPage> | undefined,
  id: string,
  update: (s: Short) => Short,
): InfiniteData<ShortsPage> | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((p) => ({ ...p, items: p.items.map((s) => (s.id === id ? update(s) : s)) })),
  };
}

export function useShortsFeed(source: ShortsSource) {
  return useInfiniteQuery({
    queryKey: shortsKey(source),
    queryFn: ({ pageParam }) => fetchPage(source, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    staleTime: 60_000,
  });
}

/** Like or unlike with an instant UI update, rolled back if the request fails. */
export function useToggleShortLike() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ short }: { short: Short }) =>
      short.liked ? shortsService.unlike(short.id) : shortsService.like(short.id),
    onMutate: async ({ short }) => {
      await qc.cancelQueries({ queryKey: ["shorts"] });
      const previous = qc.getQueriesData<InfiniteData<ShortsPage>>({ queryKey: ["shorts"] });
      qc.setQueriesData<InfiniteData<ShortsPage>>({ queryKey: ["shorts"] }, (d) =>
        patchShortInPages(d, short.id, (s) => applyLike(s, !short.liked)),
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      ctx?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (res, { short }) => {
      qc.setQueriesData<InfiniteData<ShortsPage>>({ queryKey: ["shorts"] }, (d) =>
        patchShortInPages(d, short.id, (s) => applyLike(s, res.liked, res.likesCount)),
      );
    },
  });
}
