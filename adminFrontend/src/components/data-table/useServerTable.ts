"use client";

import type { PaginationState, RowSelectionState } from "@tanstack/react-table";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * State for a server-paged list: page, page size, a debounced search and typed filters.
 * Changing the search or a filter returns to the first page.
 */
export function useServerTable<F extends Record<string, string>>({
  initialFilters,
  initialPageSize = 20,
  debounceMs = 300,
}: {
  initialFilters: F;
  initialPageSize?: number;
  debounceMs?: number;
}) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const initial = useRef(initialFilters);
  const [filters, setFilters] = useState<F>(initialFilters);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch((prev) => {
        const next = search.trim();
        if (prev !== next) setPagination((p) => ({ ...p, pageIndex: 0 }));
        return next;
      });
    }, debounceMs);
    return () => clearTimeout(t);
  }, [search, debounceMs]);

  const setFilter = useCallback(<K extends keyof F>(key: K, value: F[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, []);

  const reset = useCallback(() => {
    setSearch("");
    setDebouncedSearch("");
    setFilters(initial.current);
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, []);

  return {
    pagination,
    setPagination,
    search,
    setSearch,
    debouncedSearch,
    filters,
    setFilter,
    reset,
    rowSelection,
    setRowSelection,
    /** Query params common to every adminBackend list endpoint. */
    params: {
      page: pagination.pageIndex,
      size: pagination.pageSize,
      search: debouncedSearch,
      ...filters,
    },
  };
}
