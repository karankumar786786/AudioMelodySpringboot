import React from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { type Playlist } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { motion } from "framer-motion";

interface PlaylistCardProps {
  playlist: Playlist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  return (
    <Link
      href={`/playlists/${playlist.id}?type=system`}
      className="flex-none w-[180px] group cursor-pointer block"
    >
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="relative aspect-square overflow-hidden rounded-[2.5rem] bg-zinc-950 border border-white/5 shadow-2xl transition-all duration-500 group-hover:ring-4 group-hover:ring-primary/50 group-hover:shadow-[0_0_35px_rgba(120,240,142,0.25)]">
          <img
            src={getImageUrl(
              playlist.coverImageKey || playlist.bannerImageKey,
              {
                width: 400,
                height: 400,
                focus: "auto",
                aspectRatio: "1-1",
              },
            )}
            alt={playlist.name}
            className="h-full w-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center backdrop-blur-[2px]">
            <motion.div
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              className="h-12 w-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20"
            >
              <Play
                fill="black"
                size={20}
                className="text-black translate-x-0.5"
              />
            </motion.div>
          </div>
        </div>
        <div className="space-y-1.5 px-2">
          <h3 className="font-black text-white truncate group-hover:text-primary transition-colors text-sm uppercase italic tracking-tighter">
            {playlist.name}
          </h3>
          <p className="text-[10px] text-zinc-500 truncate font-black uppercase tracking-[0.15em] italic group-hover:text-zinc-400 transition-colors">
            {playlist.description || "Collection"}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
