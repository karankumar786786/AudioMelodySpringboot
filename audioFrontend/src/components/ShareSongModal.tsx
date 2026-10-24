"use client";

import React, { useRef, useState } from "react";
import { Copy, Check, Download, Share2, Sparkles, Music } from "lucide-react";
import { type Song } from "@/lib/api";
import { type PlayerSong } from "@/lib/player-utils";
import { getImageUrl } from "@/lib/image-utils";
import { toast } from "sonner";
import { playerActions } from "@/store/player.store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BorderBeam } from "@/components/ui/border-beam";

interface ShareSongModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | PlayerSong;
}

export const ShareSongModal: React.FC<ShareSongModalProps> = ({
  isOpen,
  onClose,
  song,
}) => {
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!song) return null;

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/home?song=${song.id}`
    : `https://audiomelody.com/songs/${song.id}`;

  const songCover = song.imageKey
    ? getImageUrl(song.imageKey, { width: 500, height: 500, aspectRatio: "1-1" })
    : (song as any).posterUrl || "";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    playerActions.recordShare(song.id);
    toast.success("Link copied to clipboard", {
      description: `Share link for "${song.title}" is ready.`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareTwitter = () => {
    const text = encodeURIComponent(`Listening to "${song.title}" by ${song.artistName} on AudioMelody 🎵✨\n${shareUrl}`);
    playerActions.recordShare(song.id);
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  const handleDownloadImage = () => {
    setIsExporting(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1920);
      bgGrad.addColorStop(0, "#181818");
      bgGrad.addColorStop(0.5, "#0d1f14");
      bgGrad.addColorStop(1, "#09090b");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Radial glow in center
      const radGrad = ctx.createRadialGradient(540, 800, 50, 540, 800, 600);
      radGrad.addColorStop(0, "rgba(34, 197, 94, 0.25)");
      radGrad.addColorStop(1, "transparent");
      ctx.fillStyle = radGrad;
      ctx.fillRect(0, 0, 1080, 1920);

      // Branding Header
      ctx.fillStyle = "#22c55e";
      ctx.font = "bold 44px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("AUDIOMELODY", 540, 220);

      ctx.fillStyle = "#a1a1aa";
      ctx.font = "500 28px sans-serif";
      ctx.fillText("NOW PLAYING", 540, 280);

      // Draw Artwork
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Rounded artwork card
        const artSize = 640;
        const artX = (1080 - artSize) / 2;
        const artY = 380;

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(artX, artY, artSize, artSize, 36);
        ctx.clip();
        ctx.drawImage(img, artX, artY, artSize, artSize);
        ctx.restore();

        // Song Title
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 64px sans-serif";
        ctx.textAlign = "center";
        const title = song.title.length > 25 ? song.title.substring(0, 25) + "..." : song.title;
        ctx.fillText(title, 540, 1160);

        // Artist Name & Album
        ctx.fillStyle = "#22c55e";
        ctx.font = "600 40px sans-serif";
        const artistSub = song.album ? `${song.artistName} • ${song.album}` : song.artistName;
        ctx.fillText(artistSub, 540, 1240);

        // Soundwave simulation bars
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        const barCount = 36;
        const totalW = 600;
        const startX = (1080 - totalW) / 2;
        for (let b = 0; b < barCount; b++) {
          const bh = 15 + Math.sin(b * 0.4) * 35 + Math.cos(b * 0.8) * 20;
          ctx.fillRect(startX + (b * (totalW / barCount)), 1380 - bh / 2, 8, bh);
        }

        // Footer CTA
        ctx.fillStyle = "#71717a";
        ctx.font = "500 30px sans-serif";
        ctx.fillText("Listen on audiomelody.com", 540, 1720);

        // Download PNG
        const link = document.createElement("a");
        link.download = `AudioMelody-${song.title.replace(/\s+/g, "_")}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("Story card downloaded!");
        setIsExporting(false);
      };

      img.onerror = () => {
        toast.error("Could not load image for story card export");
        setIsExporting(false);
      };

      img.src = songCover || "/placeholder.png";
    } catch {
      toast.error("Failed to generate story image");
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm bg-[#141414]/95 border-white/10 backdrop-blur-2xl p-5 shadow-2xl">
        <BorderBeam size={160} duration={8} colorFrom="#1ed760" colorTo="#38bdf8" />

        {/* Header */}
        <DialogHeader className="text-left pb-2 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-primary" />
            <DialogTitle className="text-sm font-bold text-white">Share Track</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Share {song.title} by {song.artistName}
          </DialogDescription>
        </DialogHeader>

        {/* 9:16 Visual Story Card Preview */}
        <div
          ref={cardRef}
          className="w-full aspect-9/14 rounded-2xl bg-linear-to-b from-zinc-800 via-zinc-900 to-black p-5 flex flex-col items-center justify-between shadow-xl border border-white/10 relative overflow-hidden mt-2"
        >
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-primary/10 blur-2xl pointer-events-none" />

          {/* Top Brand Tag */}
          <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-primary uppercase">
            <Sparkles size={12} />
            <span>AudioMelody</span>
          </div>

          {/* Center Cover Art */}
          <div className="w-40 h-40 rounded-2xl overflow-hidden bg-zinc-950 shadow-2xl border border-white/10 my-auto">
            {songCover ? (
              <img
                src={songCover}
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600">
                <Music size={40} />
              </div>
            )}
          </div>

          {/* Bottom Title & Metadata */}
          <div className="w-full text-center space-y-1 z-10">
            <h4 className="text-sm font-bold text-white truncate px-2">
              {song.title}
            </h4>
            <p className="text-xs font-semibold text-primary truncate px-2">
              {song.artistName}
              {song.album && <span className="text-zinc-300 font-normal"> • {song.album}</span>}
              {song.genre && <span className="text-zinc-400 font-normal"> • {song.genre}</span>}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-2 mt-2">
          {/* Copy Link Button */}
          <Button
            type="button"
            onClick={handleCopyLink}
            className="w-full gap-2 rounded-xl text-xs font-bold"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            <span>{copied ? "Copied Link!" : "Copy Song Link"}</span>
          </Button>

          {/* Secondary Actions */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleShareTwitter}
              className="gap-1.5 rounded-xl text-xs font-semibold"
            >
              <Share2 size={14} />
              <span>Share on X</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="gap-1.5 rounded-xl text-xs font-semibold disabled:opacity-50"
            >
              <Download size={14} />
              <span>{isExporting ? "Saving..." : "Save Image"}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
