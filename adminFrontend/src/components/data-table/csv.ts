import type { Table } from "@tanstack/react-table";

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  // Neutralise spreadsheet formula injection, then quote when needed.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** Builds CSV from the visible, exportable columns of the selected rows (or every loaded row). */
export function tableToCsv<T>(table: Table<T>): string {
  const columns = table
    .getVisibleLeafColumns()
    .filter(
      (c) =>
        c.columnDef.meta?.csv !== false &&
        (c.columnDef.meta?.csv || c.accessorFn),
    );
  const selected = table.getSelectedRowModel().rows;
  const rows = selected.length > 0 ? selected : table.getRowModel().rows;

  const header = columns.map((c) => {
    const h = c.columnDef.header;
    return escapeCell(
      c.columnDef.meta?.label ?? (typeof h === "string" ? h : c.id),
    );
  });
  const lines = rows.map((row) =>
    columns
      .map((c) => {
        const csv = c.columnDef.meta?.csv;
        return escapeCell(
          typeof csv === "function" ? csv(row.original) : row.getValue(c.id),
        );
      })
      .join(","),
  );
  return [header.join(","), ...lines].join("\r\n");
}

export function downloadCsv(csv: string, fileName: string): void {
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
