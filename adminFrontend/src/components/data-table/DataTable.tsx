"use client";

import "./types";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type OnChangeFn,
  type PaginationState,
  type Row,
  type RowSelectionState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, Download, RotateCcw } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { PaginationBar } from "@/components/PaginationBar";
import { ColumnVisibilityMenu } from "./ColumnVisibilityMenu";
import { downloadCsv, tableToCsv } from "./csv";

export interface DataTableProps<T> {
  // biome-ignore lint/suspicious/noExplicitAny: column value types differ per column
  columns: ColumnDef<T, any>[];
  data: T[];
  getRowId: (row: T) => string;
  /** Total rows on the server for the current filters. */
  rowCount: number;
  pagination: PaginationState;
  onPaginationChange: (next: PaginationState) => void;
  /** True while there is no data to show yet. */
  loading?: boolean;
  /** True during any fetch, including background refreshes. */
  fetching?: boolean;
  error?: unknown;
  onRetry?: () => void;

  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** Shown above the table while rows are selected. */
  renderBulkActions?: (selectedIds: string[], clearSelection: () => void) => ReactNode;

  /**
   * Sorting. The adminBackend list endpoints have a fixed `-created_at` order, so by
   * default the table sorts the loaded page. Pass `manualSorting` with `onSortingChange`
   * once an endpoint accepts a sort parameter.
   */
  manualSorting?: boolean;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;

  onRowClick?: (row: T) => void;
  /** Filters and search, left of the toolbar. */
  toolbar?: ReactNode;
  /** Extra buttons, right of the toolbar. */
  actions?: ReactNode;
  emptyState?: ReactNode;
  /** CSV file name; leave out to hide the export button. */
  exportFileName?: string;
  /** localStorage key for the column choice. */
  storageKey?: string;
  /** Columns hidden until the user turns them on. */
  defaultHiddenColumns?: string[];
  itemLabel?: string;
  pageSizeOptions?: number[];
  /** Render the rows some other way (for example a card grid) instead of the table body. */
  renderRows?: (rows: Row<T>[], loading: boolean) => ReactNode;
  className?: string;
}

function readVisibility(key: string | undefined, fallback: VisibilityState): VisibilityState {
  if (!key || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`table-columns:${key}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  rowCount,
  pagination,
  onPaginationChange,
  loading = false,
  fetching = false,
  error,
  onRetry,
  enableRowSelection = false,
  rowSelection: controlledSelection,
  onRowSelectionChange,
  renderBulkActions,
  manualSorting = false,
  sorting: controlledSorting,
  onSortingChange,
  onRowClick,
  toolbar,
  actions,
  emptyState,
  exportFileName,
  storageKey,
  defaultHiddenColumns,
  itemLabel = "items",
  pageSizeOptions = [10, 20, 50, 100],
  renderRows,
  className = "",
}: DataTableProps<T>) {
  const defaultVisibility = useMemo<VisibilityState>(
    () => Object.fromEntries((defaultHiddenColumns ?? []).map((id) => [id, false])),
    [defaultHiddenColumns],
  );
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(defaultVisibility);
  const [internalSelection, setInternalSelection] = useState<RowSelectionState>({});
  const [internalSorting, setInternalSorting] = useState<SortingState>([]);

  // Load the saved column choice after mount so server and client render the same markup.
  useEffect(() => {
    setColumnVisibility(readVisibility(storageKey, defaultVisibility));
  }, [storageKey, defaultVisibility]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(`table-columns:${storageKey}`, JSON.stringify(columnVisibility));
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit.
    }
  }, [storageKey, columnVisibility]);

  const rowSelection = controlledSelection ?? internalSelection;
  const setRowSelection = onRowSelectionChange ?? setInternalSelection;
  const sorting = controlledSorting ?? internalSorting;
  const setSorting = onSortingChange ?? setInternalSorting;

  const table = useReactTable<T>({
    data,
    columns,
    getRowId: (row) => getRowId(row),
    state: { pagination, rowSelection, sorting, columnVisibility },
    rowCount,
    manualPagination: true,
    manualFiltering: true,
    manualSorting,
    enableRowSelection,
    enableSortingRemoval: true,
    onPaginationChange: (updater) =>
      onPaginationChange(typeof updater === "function" ? updater(pagination) : updater),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
  });

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const clearSelection = () => setRowSelection({});
  const rows = table.getRowModel().rows;
  const visibleColumnCount = table.getVisibleLeafColumns().length;

  let body: ReactNode = null;
  if (error && data.length === 0) {
    body = (
      <div className="py-14 text-center text-xs text-zinc-400" role="alert">
        <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-amber-400/70" />
        <p className="font-semibold text-zinc-200">
          {error instanceof Error ? error.message : "Could not load data."}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-black font-bold"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try again
          </button>
        )}
      </div>
    );
  } else if (!loading && rows.length === 0) {
    body = emptyState ?? <div className="py-14 text-center text-xs text-zinc-500">No {itemLabel} found.</div>;
  } else if (renderRows) {
    body = renderRows(rows, loading);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {(toolbar || actions || exportFileName) && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">{toolbar}</div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            {!renderRows && <ColumnVisibilityMenu table={table} />}
            {exportFileName && (
              <button
                type="button"
                onClick={() => downloadCsv(tableToCsv(table), exportFileName)}
                disabled={rows.length === 0}
                title={
                  selectedIds.length > 0 ? "Export the selected rows on this page" : "Export the rows on this page"
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#141418] hover:bg-[#1a1a20] border border-white/8 text-zinc-300 hover:text-white disabled:opacity-40 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      )}

      {enableRowSelection && renderBulkActions && selectedIds.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs"
          aria-live="polite"
        >
          <span className="font-semibold text-white">{selectedIds.length} selected</span>
          {renderBulkActions?.(selectedIds, clearSelection)}
          <button type="button" onClick={clearSelection} className="ml-auto text-zinc-400 hover:text-white">
            Clear selection
          </button>
        </div>
      )}

      <div className="relative bg-[#121215] border border-white/8 rounded-2xl overflow-hidden shadow-sm">
        {fetching && (
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-zinc-500 via-white to-zinc-400 animate-pulse z-20" />
        )}

        {body !== null ? (
          <div className={renderRows ? "p-4" : ""}>{body}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs" aria-busy={loading || fetching}>
              <thead className="bg-[#0e0e11] border-b border-white/8 text-zinc-400 uppercase font-bold tracking-wider text-[10px]">
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const canSort = header.column.getCanSort();
                      const sorted = header.column.getIsSorted();
                      const content = header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext());
                      return (
                        <th
                          key={header.id}
                          scope="col"
                          aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                          className={`py-3.5 px-4 whitespace-nowrap ${header.column.columnDef.meta?.headerClassName ?? ""}`}
                        >
                          {canSort ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              title={manualSorting ? "Sort" : "Sort the rows on this page"}
                              className="inline-flex items-center gap-1 uppercase hover:text-white cursor-pointer"
                            >
                              {content}
                              {sorted === "asc" ? (
                                <ArrowUp className="w-3 h-3" />
                              ) : sorted === "desc" ? (
                                <ArrowDown className="w-3 h-3" />
                              ) : (
                                <ChevronsUpDown className="w-3 h-3 opacity-40" />
                              )}
                            </button>
                          ) : (
                            content
                          )}
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-white/6">
                {loading
                  ? Array.from({ length: Math.min(pagination.pageSize, 8) }, (_, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton rows
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: visibleColumnCount }, (_, j) => (
                          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton cells
                          <td key={j} className="py-4 px-4">
                            <div className="h-3 rounded bg-white/6" style={{ width: `${50 + ((i + j) % 4) * 12}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : rows.map((row) => (
                      <tr
                        key={row.id}
                        data-state={row.getIsSelected() ? "selected" : undefined}
                        onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                        className={`group transition-colors hover:bg-white/3 ${row.getIsSelected() ? "bg-white/4" : ""} ${
                          onRowClick ? "cursor-pointer" : ""
                        }`}
                      >
                        {row.getVisibleCells().map((cell) => (
                          <td key={cell.id} className={`py-3 px-4 ${cell.column.columnDef.meta?.cellClassName ?? ""}`}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        )}

        <PaginationBar
          page={pagination.pageIndex}
          pageSize={pagination.pageSize}
          totalItems={rowCount}
          currentCount={data.length}
          itemLabel={itemLabel}
          onPageChange={(pageIndex) => onPaginationChange({ ...pagination, pageIndex })}
          onPageSizeChange={(pageSize) => onPaginationChange({ pageIndex: 0, pageSize })}
          pageSizeOptions={pageSizeOptions}
          loading={fetching}
        />
      </div>
    </div>
  );
}
