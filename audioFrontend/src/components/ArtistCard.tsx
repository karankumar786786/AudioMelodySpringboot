import React from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { motion } from "framer-motion";
import { type Artist } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link
      href={`/artists/${artist.id}`}
      className="flex-none w-[160px] group cursor-pointer text-center block"
    >
      <motion.div
        whileHover={{ y: -6 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="space-y-4"
      >
        <div className="relative aspect-square overflow-hidden rounded-full bg-zinc-950 border border-white/5 mx-auto transition-all duration-500 group-hover:ring-4 group-hover:ring-primary/50 group-hover:shadow-[0_0_35px_rgba(120,240,142,0.25)]">
          <img
            src={
              getImageUrl(artist.coverImageKey || artist.bannerImageKey, {
                width: 300,
                height: 300,
                focus: "auto",
                aspectRatio: "1-1",
              }) || "/placeholder-artist.png"
            }
            alt={artist.name}
            className="h-full w-full object-cover group-hover:scale-108 transition-transform duration-700 ease-out"
          />
          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center backdrop-blur-[2px]">
            <motion.div
              initial={{ scale: 0.8 }}
              whileHover={{ scale: 1.1 }}
              className="w-11 h-11 rounded-full bg-primary flex items-center justify-center text-black shadow-lg"
            >
              <Play fill="black" size={18} className="translate-x-0.5" />
            </motion.div>
          </div>
        </div>
        <div className="space-y-1 px-1">
          <h3 className="font-black text-white truncate group-hover:text-primary transition-colors text-[0.95rem] uppercase italic tracking-tighter">
            {artist.name}
          </h3>
          <p className="text-[9px] text-zinc-500 uppercase tracking-[0.2em] font-black italic group-hover:text-zinc-400 transition-colors">
            Verified Artist
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
