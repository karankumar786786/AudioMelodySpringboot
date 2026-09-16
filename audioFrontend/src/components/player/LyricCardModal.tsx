"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Copy, Check, Share2, Sparkles, Image as ImageIcon } from "lucide-react";
import { type Song } from "@/lib/api";
import { type PlayerSong } from "@/lib/player-utils";
import { getImageUrl } from "@/lib/image-utils";
import { toast } from "sonner";

interface LyricCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  song: Song | PlayerSong;
  initialLyric: string;
}

type AspectRatio = "1:1" | "9:16";

interface ThemeOption {
  id: string;
  name: string;
  bgGrad: [string, string, string];
  accent: string;
}

const THEMES: ThemeOption[] = [
  {
    id: "nebula",
    name: "Nebula",
    bgGrad: ["#16082f", "#0c0414", "#05010a"],
    accent: "#a855f7",
  },
  {
    id: "sunset",
    name: "Sunset",
    bgGrad: ["#3b111e", "#1f0610", "#080105"],
    accent: "#f43f5e",
  },
  {
    id: "emerald",
    name: "Emerald",
    bgGrad: ["#062319", "#03140e", "#010705"],
    accent: "#10b981",
  },
  {
    id: "onyx",
    name: "Onyx",
    bgGrad: ["#1e1e1e", "#111111", "#080808"],
    accent: "#eab308",
  },
];

export const LyricCardModal: React.FC<LyricCardModalProps> = ({
  isOpen,
  onClose,
  song,
  initialLyric,
}) => {
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [selectedTheme, setSelectedTheme] = useState<ThemeOption>(THEMES[0]);
  const [lyricText, setLyricText] = useState<string>(initialLyric);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    setLyricText(initialLyric);
  }, [initialLyric]);

  const coverUrl = song?.imageKey
    ? getImageUrl(song.imageKey, { width: 400, height: 400, aspectRatio: "1-1" })
    : (song as any)?.posterUrl || "";

  // Draw High-Res Canvas
  const drawCanvas = useCallback(async (): Promise<HTMLCanvasElement | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const isStory = aspectRatio === "9:16";
    const width = 1080;
    const height = isStory ? 1920 : 1080;

    canvas.width = width;
    canvas.height = height;

    // 1. Background Gradient (Clean matte gradient with no glow)
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, selectedTheme.bgGrad[0]);
    grad.addColorStop(0.55, selectedTheme.bgGrad[1]);
    grad.addColorStop(1, selectedTheme.bgGrad[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // 2. Load & Draw Album Artwork
    if (coverUrl) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve) => {
          img.onload = resolve;
          img.onerror = resolve;
          img.src = coverUrl;
        });

        const artSize = isStory ? 380 : 300;
        const artX = (width - artSize) / 2;
        const artY = isStory ? 280 : 120;

        // Draw shadow under artwork
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 40;
        ctx.shadowOffsetY = 20;

        // Rounded clip for artwork
        const radius = 28;
        ctx.beginPath();
        ctx.moveTo(artX + radius, artY);
        ctx.lineTo(artX + artSize - radius, artY);
        ctx.quadraticCurveTo(artX + artSize, artY, artX + artSize, artY + radius);
        ctx.lineTo(artX + artSize, artY + artSize - radius);
        ctx.quadraticCurveTo(artX + artSize, artY + artSize, artX + artSize - radius, artY + artSize);
        ctx.lineTo(artX + radius, artY + artSize);
        ctx.quadraticCurveTo(artX, artY + artSize, artX, artY + artSize - radius);
        ctx.lineTo(artX, artY + radius);
        ctx.quadraticCurveTo(artX, artY, artX + radius, artY);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, artX, artY, artSize, artSize);
        ctx.restore();
      } catch {}
    }

    // 3. Reset all shadows so text has absolutely zero glow
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 4. Song Title & Artist Name
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metaY = isStory ? 740 : 480;
    ctx.font = "900 42px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(song.title.length > 30 ? song.title.slice(0, 28) + "..." : song.title, width / 2, metaY);

    ctx.font = "600 28px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(song.artistName, width / 2, metaY + 50);

    // 5. Clean Elegant Quote Marks & Lyric Text (Zero Glow)
    const lyricStartY = isStory ? 1040 : 660;

    ctx.font = "800 64px Georgia, serif";
    ctx.fillStyle = selectedTheme.accent;
    ctx.fillText("“", width / 2, lyricStartY - 50);

    // Word Wrap Lyric Quote
    ctx.font = "700 48px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    const maxWidth = width - 200;
    const words = lyricText.split(" ");
    let line = "";
    const lines: string[] = [];

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());

    const lineHeight = 65;
    lines.forEach((l, idx) => {
      ctx.fillText(l, width / 2, lyricStartY + idx * lineHeight);
    });

    // 6. AudioMelody Branding Badge at Bottom
    const footerY = height - 90;
    ctx.font = "800 24px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.fillText("🎵 AUDIOMELODY", width / 2, footerY);

    return canvas;
  }, [aspectRatio, selectedTheme, lyricText, coverUrl, song.title, song.artistName]);

  // Redraw when settings change
  useEffect(() => {
    if (isOpen) {
      drawCanvas();
    }
  }, [isOpen, drawCanvas]);

  const handleDownload = async () => {
    setIsExporting(true);
    try {
      const canvas = await drawCanvas();
      if (!canvas) return;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1.0),
      );
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${song.title.replace(/\s+/g, "-")}-lyric-card.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Lyric card saved!", {
        description: "Image ready for Instagram Stories & WhatsApp status.",
      });
    } catch {
      toast.error("Failed to export image");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyImage = async () => {
    setIsExporting(true);
    try {
      const canvas = await drawCanvas();
      if (!canvas) return;

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png", 1.0),
      );
      if (!blob) return;

      if (navigator.clipboard && typeof (window as any).ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        toast.success("Image copied to clipboard!", {
          description: "Paste it directly into chats, WhatsApp, or Instagram.",
        });
        setTimeout(() => setCopied(false), 2500);
      } else {
        handleDownload();
      }
    } catch (err) {
      console.warn("Copy to clipboard failed, downloading instead", err);
      handleDownload();
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-2xl bg-zinc-900 border border-white/15 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <div>
                <h3 className="font-bold text-white text-base sm:text-lg">
                  Share Lyric Story Card
                </h3>
                <p className="text-xs text-zinc-400">
                  Export aesthetic quote for Instagram, WhatsApp & Twitter
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body: Controls + Live Canvas Preview */}
          <div className="flex-1 overflow-y-auto my-4 space-y-5">
            {/* Format & Theme Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 p-3 rounded-2xl border border-white/5">
              {/* Aspect Ratio */}
              <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl">
                <button
                  onClick={() => setAspectRatio("1:1")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    aspectRatio === "1:1"
                      ? "bg-white text-black shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  1:1 Square
                </button>
                <button
                  onClick={() => setAspectRatio("9:16")}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    aspectRatio === "9:16"
                      ? "bg-white text-black shadow-md"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  9:16 Story
                </button>
              </div>

              {/* Theme Selector */}
              <div className="flex items-center gap-1.5">
                {THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => setSelectedTheme(theme)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                      selectedTheme.id === theme.id
                        ? "border-white text-white shadow-sm"
                        : "border-transparent text-zinc-400 hover:text-white bg-white/5"
                    }`}
                    style={{
                      background: selectedTheme.id === theme.id ? theme.bgGrad[0] : undefined,
                    }}
                  >
                    {theme.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Lyric Textarea */}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-zinc-400">
                Selected Lyric Quote
              </label>
              <textarea
                value={lyricText}
                onChange={(e) => setLyricText(e.target.value)}
                rows={2}
                className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary resize-none"
              />
            </div>

            {/* Live Canvas Element (Responsive Scale) */}
            <div className="flex items-center justify-center p-4 bg-black/60 rounded-2xl border border-white/5 overflow-hidden">
              <canvas
                ref={canvasRef}
                style={{
                  width: aspectRatio === "1:1" ? "320px" : "200px",
                  height: aspectRatio === "1:1" ? "320px" : "355px",
                }}
                className="rounded-xl shadow-2xl object-contain border border-white/10"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleCopyImage}
              disabled={isExporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copied ? "Copied!" : "Copy Image"}</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:brightness-110 text-xs font-bold text-black transition-all cursor-pointer active:scale-95 shadow-lg disabled:opacity-50"
            >
              <Download size={14} />
              <span>Download Card</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
