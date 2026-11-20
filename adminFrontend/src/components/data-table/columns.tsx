"use client";

import type { ColumnDef } from "@tanstack/react-table";

/** Checkbox column for multi-select; the header box selects the loaded page. */
export function selectionColumn<T>(): ColumnDef<T> {
  return {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    meta: { csv: false, headerClassName: "w-10", cellClassName: "w-10" },
    header: ({ table }) => (
      <input
        type="checkbox"
        aria-label="Select all rows on this page"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => {
          if (el) el.indeterminate = table.getIsSomePageRowsSelected();
        }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 cursor-pointer"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        aria-label="Select row"
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onClick={(e) => e.stopPropagation()}
        onChange={row.getToggleSelectedHandler()}
        className="rounded border-zinc-700 bg-zinc-900 text-white focus:ring-0 cursor-pointer"
      />
    ),
  };
}
