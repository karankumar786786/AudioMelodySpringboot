"use client";

import React from "react";
import { ExternalLink, Music } from "lucide-react";

interface RightInfoSongBioSectionProps {
  description?: string | null;
  source?: string | null;
}

export function RightInfoSongBioSection({
  description,
  source,
}: RightInfoSongBioSectionProps) {
  if (!description) return null;

  return (
    <section className="bg-[#121212] border border-[#222] rounded-2xl overflow-hidden p-4 shadow-xl">
      <div className="flex items-center gap-2 mb-2">
        <Music size={15} className="text-primary" />
        <h3 className="text-sm font-bold text-white">
          About the Song
        </h3>
      </div>

      <p className="text-xs text-zinc-300 leading-relaxed line-clamp-5">
        {description}
      </p>

      {source && (
        <a
          href={source}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline font-medium mt-2.5"
        >
          View on Wikipedia
          <ExternalLink size={11} />
        </a>
      )}
    </section>
  );
}
