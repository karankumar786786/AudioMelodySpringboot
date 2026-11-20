"use client";

import { Loader2, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/feedback/ToastProvider";
import type { Playlist } from "@/app/playlists/types";
import { useUpdatePlaylist } from "@/lib/queries/playlists";
import { uploadToImageKitWithProgress } from "@/lib/upload-utils";

export function TeaserVideoControls({ playlist, editable }: { playlist: Playlist; editable: boolean }) {
  const toast = useToast();
  const update = useUpdatePlaylist(playlist.id);
  const [uploading, setUploading] = useState(false);
  const removing = update.isPending && update.variables?.videoKey === null;

  const attach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const videoKey = await uploadToImageKitWithProgress(file, "/playlists/videos");
      await update.mutateAsync({ videoKey });
      toast("Playlist teaser video loop updated!");
    } catch (err) {
      console.error("Video attachment failed:", err);
      toast("Failed to upload teaser video", "error");
    } finally {
      setUploading(false);
    }
  };

  const remove = () =>
    update.mutate(
      { videoKey: null },
      {
        onSuccess: () => toast("Playlist teaser video removed"),
        onError: () => toast("Error removing video", "error"),
      },
    );

  return (
    <div className="p-4 rounded-2xl bg-black/40 border border-white/8 space-y-3 min-w-[240px]">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-zinc-400 flex items-center gap-1.5">
          <Video className="w-4 h-4 text-white" />
          Teaser Video Loop
        </span>
        {playlist.videoKey ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/20">
            Attached
          </span>
        ) : (
          <span className="text-[10px] text-zinc-500 font-mono">None</span>
        )}
      </div>

      {editable && (
        <div className="flex items-center gap-2">
          <label
            className={`flex-1 cursor-pointer bg-[#18181c] hover:bg-[#202026] border border-white/10 hover:border-white/20 text-white px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
              uploading ? "opacity-75 cursor-wait" : ""
            }`}
          >
            {uploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Uploading...</span>
              </>
            ) : (
              <>
                <Video className="w-3.5 h-3.5 text-white" />
                <span>{playlist.videoKey ? "Replace Video" : "Attach Loop"}</span>
              </>
            )}
            <input type="file" accept="video/*" onChange={attach} disabled={uploading || removing} className="hidden" />
          </label>

          {playlist.videoKey && (
            <button
              type="button"
              onClick={remove}
              disabled={uploading || removing}
              className="p-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl transition-all cursor-pointer disabled:opacity-50"
              title="Remove attached teaser video"
              aria-label="Remove teaser video"
            >
              {removing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
