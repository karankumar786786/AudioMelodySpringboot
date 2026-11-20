"use client";

import { UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { type CatalogStatus, CatalogStatusFilter } from "@/components/catalog/StatusFilter";
import { DataTable } from "@/components/data-table/DataTable";
import { SearchInput } from "@/components/data-table/Toolbar";
import { useServerTable } from "@/components/data-table/useServerTable";
import { type ViewMode, ViewToggle } from "@/components/data-table/ViewToggle";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { usePermissions } from "@/lib/permissions";
import { useArtists, useDeleteArtist } from "@/lib/queries/artists";
import { artistColumns } from "./components/artistColumns";
import { ArtistsGrid } from "./components/ArtistsGrid";
import { CreateArtistModal } from "./components/CreateArtistModal";
import type { Artist } from "./types";

export default function ArtistsPage() {
  const { can } = usePermissions();
  const confirm = useConfirm();
  const table = useServerTable({ initialFilters: { status: "ACTIVE" as CatalogStatus } });
  const { pagination } = table;
  const artistsQuery = useArtists({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    search: table.debouncedSearch,
    status: table.filters.status,
  });
  const rows = artistsQuery.data?.rows ?? [];
  const total = artistsQuery.data?.total ?? 0;

  const [view, setView] = useState<ViewMode>("grid");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const deleteArtist = useDeleteArtist();

  const handleDelete = async (artist: Artist) => {
    const ok = await confirm({
      title: `Delete artist "${artist.name}"?`,
      description: "This deletes the artist and may affect their songs.",
      confirmLabel: "Delete artist",
      destructive: true,
      typeToConfirm: artist.name,
    });
    if (ok) deleteArtist.mutate(artist);
  };
  const onDelete = can("artist.delete") ? handleDelete : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleDelete reads fresh state when called
  const columns = useMemo(() => artistColumns({ onDelete }), [Boolean(onDelete)]);

  return (
    <div className="p-6 md:p-8 max-w-400 mx-auto space-y-6 text-white font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#121215] p-5 rounded-2xl border border-white/8">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Artist Management</h1>
          <p className="text-zinc-400 mt-1 text-xs leading-relaxed">
            Manage artist profiles, discographies, cover artwork, and bios.
          </p>
        </div>
        {can("artist.create") && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="bg-white hover:bg-zinc-200 text-black px-4 py-2 rounded-xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2 shadow-sm text-xs shrink-0 cursor-pointer self-start md:self-auto"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Add Artist</span>
          </button>
        )}
      </div>

      <DataTable<Artist>
        columns={columns}
        data={rows}
        getRowId={(a) => a.id}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={table.setPagination}
        loading={artistsQuery.isPending}
        fetching={artistsQuery.isFetching}
        error={artistsQuery.error}
        onRetry={() => artistsQuery.refetch()}
        enableRowSelection={view === "table"}
        rowSelection={table.rowSelection}
        onRowSelectionChange={table.setRowSelection}
        renderBulkActions={() => <span className="text-zinc-400">Export the selection with Export CSV.</span>}
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search artists..." />
            <CatalogStatusFilter value={table.filters.status} onChange={(v) => table.setFilter("status", v)} />
          </>
        }
        actions={<ViewToggle value={view} onChange={setView} />}
        exportFileName="artists"
        storageKey="artists"
        itemLabel="artists"
        renderRows={
          view === "grid"
            ? (tableRows, loading) => (
                <ArtistsGrid
                  artists={tableRows.map((r) => r.original)}
                  loading={loading}
                  onDelete={
                    onDelete
                      ? (id) => {
                          const a = rows.find((x) => x.id === id);
                          if (a) onDelete(a);
                        }
                      : undefined
                  }
                />
              )
            : undefined
        }
      />

      <CreateArtistModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
