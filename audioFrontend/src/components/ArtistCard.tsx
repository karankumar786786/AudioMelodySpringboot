import { motion } from "framer-motion";
import Link from "next/link";
import type { Artist } from "../lib/api";
import { getImageUrl } from "../lib/image-utils";

interface ArtistCardProps {
  artist: Artist;
}

export function ArtistCard({ artist }: ArtistCardProps) {
  return (
    <Link
      href={`/artists/${artist.id}`}
      className="flex-none w-[115px] sm:w-[124px] group cursor-pointer text-center block"
    >
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
        className="bg-black p-2 rounded-lg hover:bg-[#282828] transition-all duration-300 space-y-1.5"
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
        <div className="px-0.5 min-h-[34px] flex items-center justify-center">
          <h3
            className="font-semibold text-zinc-100 group-hover:text-white line-clamp-2 leading-tight text-[12px] sm:text-[12.5px] text-center transition-colors"
            title={artist.name}
          >
            {artist.name}
          </h3>
        </div>
      </motion.div>
    </Link>
  );
}
