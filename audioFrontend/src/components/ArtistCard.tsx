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
      className="flex-none w-[145px] group cursor-pointer text-center block"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className="bg-black p-4 rounded-md hover:bg-[#282828] transition-all duration-300 space-y-3"
      >
        <div className="relative aspect-square overflow-hidden rounded-full bg-zinc-900 mx-auto shadow-md">
          <img
            src={
              getImageUrl(artist.coverImageKey, {
                width: 300,
                height: 300,
                focus: "auto",
                aspectRatio: "1-1",
              }) || "/placeholder-artist.png"
            }
            alt={artist.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
          />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-white truncate text-[14px]">
            {artist.name}
          </h3>
        </div>
      </motion.div>
    </Link>
  );
}
