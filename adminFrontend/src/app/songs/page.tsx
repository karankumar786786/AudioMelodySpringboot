"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AddToPlaylistModal } from "@/components/AddToPlaylistModal";
import { DataTable } from "@/components/data-table/DataTable";
import { useServerTable } from "@/components/data-table/useServerTable";
import { EditSongModal } from "@/components/edit-song/EditSongModal";
import type { SongData } from "@/components/edit-song/types";
import { useConfirm } from "@/components/feedback/ConfirmProvider";
import { useToast } from "@/components/feedback/ToastProvider";
import { usePermissions } from "@/lib/permissions";
import {
  type SongPreset,
  useBulkDeleteSongs,
  useDeleteSong,
  useMergeSong,
  useSong,
  useSongs,
  useSyncMetadata,
  useToggleFeatured,
} from "@/lib/queries/songs";
import { BulkActionsBar } from "./components/BulkActionsBar";
import { CreateSongModal } from "./components/CreateSongModal";
import { SongsFilterBar } from "./components/SongsFilterBar";
import { SongsGrid } from "./components/SongsGrid";
import { SONG_DEFAULT_HIDDEN, songColumns } from "./components/songColumns";
import type { Song } from "./types";

function SongsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const isNewQuery = searchParams.get("new") === "true";

  const { can } = usePermissions();
  const confirm = useConfirm();
  const toast = useToast();

  const table = useServerTable({
    initialFilters: { genre: "ALL", preset: "ALL" as SongPreset },
  });
  const { pagination, filters, rowSelection, setRowSelection } = table;
  const songsQuery = useSongs({
    page: pagination.pageIndex,
    size: pagination.pageSize,
    search: table.debouncedSearch,
    genre: filters.genre,
    preset: filters.preset,
  });
  const rows = songsQuery.data?.rows ?? [];
  const total = songsQuery.data?.total ?? 0;

  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [isCreateOpen, setIsCreateOpen] = useState(isNewQuery);
  const [editingSong, setEditingSong] = useState<SongData | null>(null);
  const [playlistTarget, setPlaylistTarget] = useState<Song | null>(null);

  // `?edit=<id>` opens the editor, from the loaded page or by fetching the song.
  const editFromList = editId ? rows.find((s) => s.id === editId) : undefined;
  const editFetch = useSong(editId && !editFromList ? editId : null);
  const editTarget: SongData | null =
    editingSong ??
    (editId
      ? (((editFromList ?? editFetch.data) as SongData | undefined) ?? null)
      : null);

  const toggleFeatured = useToggleFeatured();
  const deleteSong = useDeleteSong();
  const bulkDelete = useBulkDeleteSongs();
  const syncMetadata = useSyncMetadata();
  const mergeSong = useMergeSong();

  const selectedIds = Object.keys(rowSelection).filter(
    (id) => rowSelection[id],
  );

  const handleDelete = async (song: Song) => {
    const ok = await confirm({
      title: `Delete "${song.title}"?`,
      description:
        "This starts a cascade purge across S3, the CDN, search and recommendations.",
      confirmLabel: "Delete track",
      destructive: true,
      typeToConfirm: song.title,
    });
    if (!ok) return;
    setRowSelection((prev) => {
      const next = { ...prev };
      delete next[song.id];
      return next;
    });
    deleteSong.mutate(song);
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.length;
    const phrase = `delete ${count} tracks`;
    const ok = await confirm({
      title: `Delete ${count} selected tracks?`,
      description:
        "Each track starts a cascade purge across S3, the CDN, search and recommendations.",
      confirmLabel: "Delete tracks",
      destructive: true,
      typeToConfirm: phrase,
    });
    if (!ok) return;
    bulkDelete.mutate(selectedIds, { onSuccess: () => setRowSelection({}) });
  };

  const handleSync = (what: string) => () => {
    toast(`Triggering ${what} sync...`, "info");
    syncMetadata.mutate(undefined, {
      onSuccess: () => {
        toast(`${what} synced successfully`);
        setRowSelection({});
      },
      onError: (err) => toast(err.message, "error"),
    });
  };

  const actions = {
    onToggleFeatured: can("song.feature")
      ? (song: Song) =>
          toggleFeatured.mutate({ song, featured: !song.isFeatured })
      : undefined,
    onEdit: can("song.edit")
      ? (song: Song) => setEditingSong(song as SongData)
      : undefined,
    onDelete: can("song.delete") ? handleDelete : undefined,
    onAddToPlaylist: can("playlist.edit")
      ? (song: Song) => setPlaylistTarget(song)
      : undefined,
    busyId: toggleFeatured.isPending
      ? toggleFeatured.variables?.song.id
      : deleteSong.isPending
        ? deleteSong.variables?.id
        : null,
  };

  const selectable = can("song.delete") || can("system.syncMetadata");
  const columns = songColumns(actions, selectable);

  const closeEdit = () => {
    setEditingSong(null);
    if (editId) router.replace("/songs");
  };

  return (
    <div className="p-6 md:p-8 max-w-400 mx-auto space-y-6 text-white font-sans">
      <SongsFilterBar
        search={table.search}
        onSearchChange={table.setSearch}
        genreFilter={filters.genre}
        onGenreFilterChange={(genre) => table.setFilter("genre", genre)}
        presetFilter={filters.preset}
        onPresetFilterChange={(preset) => table.setFilter("preset", preset)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        totalSongs={total}
        pageSize={pagination.pageSize}
        onPageSizeChange={(pageSize) =>
          table.setPagination({ pageIndex: 0, pageSize })
        }
        onOpenCreateModal={
          can("song.create") ? () => setIsCreateOpen(true) : undefined
        }
      />

      <DataTable<Song>
        columns={columns}
        data={rows}
        getRowId={(s) => s.id}
        rowCount={total}
        pagination={pagination}
        onPaginationChange={table.setPagination}
        loading={songsQuery.isPending}
        fetching={songsQuery.isFetching}
        error={songsQuery.error}
        onRetry={() => songsQuery.refetch()}
        enableRowSelection={selectable}
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
        exportFileName="songs"
        storageKey="songs"
        defaultHiddenColumns={SONG_DEFAULT_HIDDEN}
        itemLabel="tracks"
        renderRows={
          viewMode === "grid"
            ? (tableRows, loading) => (
                <SongsGrid
                  songs={tableRows.map((r) => r.original)}
                  loading={loading}
                  togglingSongId={
                    toggleFeatured.isPending
                      ? (toggleFeatured.variables?.song.id ?? null)
                      : null
                  }
                  deletingSongId={
                    deleteSong.isPending
                      ? (deleteSong.variables?.id ?? null)
                      : null
                  }
                  onToggleFeatured={actions.onToggleFeatured}
                  onEditSong={actions.onEdit}
                  onDeleteSong={
                    actions.onDelete
                      ? (id) => {
                          const song = rows.find((s) => s.id === id);
                          if (song) handleDelete(song);
                        }
                      : undefined
                  }
                  onAddToPlaylist={actions.onAddToPlaylist}
                />
              )
            : undefined
        }
      />

      <BulkActionsBar
        selectedCount={selectedIds.length}
        onClearSelection={() => setRowSelection({})}
        onBulkDelete={can("song.delete") ? handleBulkDelete : undefined}
        onBulkSyncAlgolia={
          can("system.syncMetadata") ? handleSync("Search index") : undefined
        }
        onBulkSyncRecombee={
          can("system.syncMetadata")
            ? handleSync("Recombee catalog")
            : undefined
        }
        isProcessing={bulkDelete.isPending || syncMetadata.isPending}
      />

      <AddToPlaylistModal
        song={playlistTarget}
        isOpen={Boolean(playlistTarget)}
        onClose={() => setPlaylistTarget(null)}
        onSuccess={(playlistName) =>
          toast(`Track added to playlist "${playlistName}"`)
        }
      />

      <CreateSongModal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          if (isNewQuery) router.replace("/songs");
        }}
      />

      <EditSongModal
        song={editTarget}
        isOpen={Boolean(editTarget)}
        onClose={closeEdit}
        onSuccess={(updated) => {
          mergeSong(updated);
          toast(`Track "${updated.title}" updated successfully`);
          closeEdit();
        }}
      />
    </div>
  );
}

export default function SongsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-center text-zinc-500 text-sm">
          Loading track manager...
        </div>
      }
    >
      <SongsContent />
    </Suspense>
  );
}
