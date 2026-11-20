import type { RowData } from "@tanstack/react-table";

declare module "@tanstack/react-table" {
  // biome-ignore lint/correctness/noUnusedVariables: the generics must match TanStack's declaration
  interface ColumnMeta<TData extends RowData, TValue> {
    /** Human label for the column menu and the CSV header. Defaults to the header string. */
    label?: string;
    /** Value written to CSV. Defaults to the accessor value; `false` leaves the column out. */
    csv?: ((row: TData) => unknown) | false;
    headerClassName?: string;
    cellClassName?: string;
  }
}
