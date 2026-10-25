"use client";

import React from "react";
import { Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BorderBeam } from "@/components/ui/border-beam";

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
      { keys: ["Z"], label: "Zen Focus Mode (Minimalist)" },
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
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-[#161616]/95 border-white/10 backdrop-blur-2xl p-6 shadow-2xl">
        <BorderBeam size={160} duration={8} colorFrom="#ffffff" colorTo="#a1a1aa" />

        {/* Header */}
        <DialogHeader className="text-left pb-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center text-primary">
              <Keyboard size={18} />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-white tracking-tight">
                Keyboard Shortcuts
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400">
                Control your music playback effortlessly
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Shortcuts List in ScrollArea */}
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-5 py-2">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.category} className="space-y-2">
                <h4 className="text-xs font-bold text-primary uppercase tracking-wider">
                  {group.category}
                </h4>
                <div className="space-y-1">
                  {group.items.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <span className="text-xs font-medium text-zinc-300">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1">
                        {item.keys.map((k) => (
                          <kbd
                            key={k}
                            className="px-2 py-0.5 rounded-md bg-white/10 border border-white/15 text-[11px] font-mono font-semibold text-zinc-200 shadow-sm"
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
