"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Users2 } from "lucide-react";
import type { Artist } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";
import { formatFollowerCount } from "../lib/player-utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  const imageUrl =
    getImageUrl(artist.coverImageKey, {
      width: 300,
      height: 300,
      focus: "auto",
      aspectRatio: "1-1",
    }) || "/placeholder-artist.png";

  const initials = artist.name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "AR";

  return (
    <Link
      href={`/artists/${artist.id}`}
      className="flex-none w-28.75 sm:w-31 group cursor-pointer text-center block"
    >
      <motion.div
        whileHover={{ scale: 1.03 }}
        transition={{ duration: 0.2 }}
        className="bg-black/90 p-2 rounded-xl hover:bg-[#222222] border border-white/5 hover:border-white/15 transition-all duration-300 space-y-2"
      >
        <Avatar className="w-24 h-24 sm:w-26 sm:h-26 mx-auto border border-white/10 shadow-lg group-hover:border-primary/40 transition-colors">
          <AvatarImage
            src={imageUrl}
            alt={artist.name}
            className="group-hover:scale-105 transition-transform duration-300 ease-out"
          />
          <AvatarFallback className="text-sm font-bold bg-zinc-800 text-zinc-300">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="px-0.5 space-y-0.5">
          <h3
            className="font-semibold text-zinc-100 group-hover:text-white line-clamp-1 leading-tight text-[12px] sm:text-[12.5px] text-center transition-colors"
            title={artist.name}
          >
            {artist.name}
          </h3>
          <p
            className="text-[10.5px] sm:text-[11px] text-zinc-400 group-hover:text-zinc-300 transition-colors text-center line-clamp-1 font-medium flex items-center justify-center gap-1"
            title={`${(artist.followersCount ?? 0).toLocaleString()} followers`}
          >
            <Users2 size={11} className="shrink-0 text-zinc-500 group-hover:text-zinc-400" />
            <span>{formatFollowerCount(artist.followersCount, true)}</span>
          </p>
        </div>
      </motion.div>
    </Link>
  );
}
