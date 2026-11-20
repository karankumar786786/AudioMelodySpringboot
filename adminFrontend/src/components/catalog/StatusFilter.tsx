"use client";

import { SegmentedFilter } from "@/components/data-table/Toolbar";

export type CatalogStatus = "ACTIVE" | "DELETED" | "ALL";

/** Status filter for catalog lists; the list views default to ACTIVE. */
export function CatalogStatusFilter({
  value,
  onChange,
}: {
  value: CatalogStatus;
  onChange: (v: CatalogStatus) => void;
}) {
  return (
    <SegmentedFilter<CatalogStatus>
      label="Status"
      value={value}
      onChange={onChange}
      options={[
        { value: "ACTIVE", label: "Active" },
        { value: "DELETED", label: "Deleted" },
        { value: "ALL", label: "All" },
      ]}
    />
  );
}
