"use client";

import { ListMusic, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { type CatalogStatus, CatalogStatusFilter } from "@/components/catalog/StatusFilter";
import { DataTable } from "@/components/data-table/DataTable";
import { SearchInput } from "@/components/data-table/Toolbar";
import { useServerTable } from "@/components/data-table/useServerTable";
import { type ViewMode, ViewToggle } from "@/components/data-table/ViewToggle";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { usePermissions } from "@/lib/permissions";
import { useDeletePlaylist, usePlaylists } from "@/lib/queries/playlists";
import { CreatePlaylistModal } from "./components/CreatePlaylistModal";
import { PlaylistsGrid } from "./components/PlaylistsGrid";
import { playlistColumns } from "./components/playlistColumns";
import type { Playlist } from "./types";

export default function PlaylistsPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const confirm = useConfirm();
  const table = useServerTable({ initialFilters: { status: "ACTIVE" as CatalogStatus } });
  const { pagination } = table;
  const playlistsQuery = usePlaylists({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    search: table.debouncedSearch,
    status: table.filters.status,
  });
  const rows = playlistsQuery.data?.rows ?? [];
  const total = playlistsQuery.data?.total ?? 0;

  const [view, setView] = useState<ViewMode>("grid");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const deletePlaylist = useDeletePlaylist();
  const deletingId = deletePlaylist.isPending ? (deletePlaylist.variables?.id ?? null) : null;

  const handleDelete = async (playlist: Pick<Playlist, "id" | "name">) => {
    const ok = await confirm({
      title: `Delete playlist "${playlist.name}"?`,
      description: "The playlist and its cover and teaser media are removed.",
      confirmLabel: "Delete playlist",
      destructive: true,
      typeToConfirm: playlist.name,
    });
    if (ok) deletePlaylist.mutate(playlist);
  };
  const onDelete = can("playlist.delete") ? handleDelete : undefined;

  // biome-ignore lint/correctness/useExhaustiveDependencies: handleDelete reads fresh state when called
  const columns = useMemo(() => playlistColumns({ onDelete, deletingId }), [Boolean(onDelete), deletingId]);
  const open = (p: Playlist) => router.push(`/playlists/${p.id}`);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-[#121215] p-4 rounded-2xl border border-white/8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <ListMusic className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Playlists Studio</h1>
            <p className="text-xs text-zinc-400">
              {rows.length} of {total} {total === 1 ? "collection" : "collections"} curated
            </p>
          </div>
        </div>
        {can("playlist.create") && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-xl transition-all shadow-lg active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>New Playlist</span>
          </button>
        )}
      </div>

      <DataTable<Playlist>
        columns={columns}
        data={rows}
        getRowId={(p) => p.id}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={table.setPagination}
        loading={playlistsQuery.isPending}
        fetching={playlistsQuery.isFetching}
        error={playlistsQuery.error}
        onRetry={() => playlistsQuery.refetch()}
        onRowClick={open}
        enableRowSelection={view === "table"}
        rowSelection={table.rowSelection}
        onRowSelectionChange={table.setRowSelection}
        renderBulkActions={() => <span className="text-zinc-400">Export the selection with Export CSV.</span>}
        toolbar={
          <>
            <SearchInput value={table.search} onChange={table.setSearch} placeholder="Search playlists..." />
            <CatalogStatusFilter value={table.filters.status} onChange={(v) => table.setFilter("status", v)} />
          </>
        }
        actions={<ViewToggle value={view} onChange={setView} />}
        exportFileName="playlists"
        storageKey="playlists"
        defaultHiddenColumns={["createdAt"]}
        itemLabel="playlists"
        renderRows={
          view === "grid"
            ? (tableRows, loading) => (
                <PlaylistsGrid
                  playlists={tableRows.map((r) => r.original)}
                  loading={loading}
                  deletingPlaylistId={deletingId}
                  onSelectPlaylist={open}
                  onDeletePlaylist={onDelete ? (id, name) => onDelete({ id, name }) : undefined}
                />
              )
            : undefined
        }
      />

      <CreatePlaylistModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />
    </div>
  );
}
