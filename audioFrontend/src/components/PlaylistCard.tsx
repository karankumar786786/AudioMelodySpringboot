import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Play } from "lucide-react";
import { type Playlist } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { motion } from "framer-motion";

interface PlaylistCardProps {
  playlist: Playlist;
}

export function PlaylistCard({ playlist }: PlaylistCardProps) {
  const imageUrl = playlist.coverImageKey
    ? getImageUrl(playlist.coverImageKey, {
        width: 400,
        height: 400,
        focus: "auto",
        aspectRatio: "1-1",
      })
    : "";

  return (
    <Link
      href={`/playlists/${playlist.id}?type=system`}
      className="flex-none w-[180px] group cursor-pointer block"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className="bg-black p-4 rounded-md hover:bg-[#282828] transition-all duration-300 space-y-3"
      >
        <div className="relative aspect-square overflow-hidden rounded-md bg-zinc-900 shadow-md">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={playlist.name || "Playlist cover"}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 180px"
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300 ease-out"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-600">
              <span className="text-xs">No Image</span>
            </div>
          )}
          <div className="absolute bottom-2 right-2 translate-y-2 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
              <Play
                fill="black"
                size={18}
                className="text-black translate-x-0.5"
              />
            </div>
          </div>
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-white truncate text-[14px]">
            {playlist.name}
          </h3>
          <p className="text-xs text-zinc-300 truncate font-medium">
            {playlist.description || "Playlist"}
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
