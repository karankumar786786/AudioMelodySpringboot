"use client";

import React from "react";
import { X, Keyboard } from "lucide-react";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  label: string;
}

interface ShortcutCategory {
  category: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutCategory[] = [
  {
    category: "Playback",
    items: [
      { keys: ["Space", "K"], label: "Play / Pause" },
      { keys: ["Ctrl", "→"], label: "Next track" },
      { keys: ["Ctrl", "←"], label: "Previous track" },
      { keys: ["→"], label: "Seek forward 10 seconds" },
      { keys: ["←"], label: "Seek rewind 10 seconds" },
      { keys: ["0 - 9"], label: "Jump to percentage (0% - 90%)" },
    ],
  },
  {
    category: "Volume & Sound",
    items: [
      { keys: ["M"], label: "Mute / Unmute" },
      { keys: ["↑"], label: "Increase volume 5%" },
      { keys: ["↓"], label: "Decrease volume 5%" },
      { keys: ["Scroll Wheel"], label: "Adjust volume on slider" },
    ],
  },
  {
    category: "Search & Navigation",
    items: [
      { keys: ["⌘ / Ctrl", "K"], label: "Quick-Search Command Palette" },
      { keys: ["/"], label: "Focus search / Open palette" },
    ],
  },
  {
    category: "Panels & Views",
    items: [
      { keys: ["V"], label: "Watch Full Video (if available)" },
      { keys: ["L"], label: "Spotify Synced Lyrics" },
      { keys: ["Q"], label: "Queue Drawer" },
      { keys: ["E"], label: "Equalizer & Visualizer" },
      { keys: ["R"], label: "Resync lyrics scroll" },
      { keys: ["?"], label: "Toggle keyboard shortcuts" },
      { keys: ["Esc"], label: "Close active modal / panel" },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-[#181818] border border-white/10 shadow-2xl p-6 select-none animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Keyboard size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">
                Keyboard Shortcuts
              </h3>
              <p className="text-xs text-zinc-400">
                Control your music playback effortlessly
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close shortcuts"
          >
            <X size={18} />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="mt-4 space-y-5 max-h-[65vh] overflow-y-auto no-scrollbar pr-1">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-2">
              <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                {group.category}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between py-1 px-2 rounded-lg hover:bg-white/5 transition-colors"
                  >
                    <span className="text-xs font-medium text-zinc-300">
                      {item.label}
                    </span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-0.5 rounded-md bg-[#282828] border border-white/15 text-[11px] font-mono font-semibold text-zinc-200 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
