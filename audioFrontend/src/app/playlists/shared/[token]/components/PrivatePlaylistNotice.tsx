"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import Link from "next/link";

export const PrivatePlaylistNotice: React.FC = () => {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full rounded-2xl bg-[#141414] border border-[#282828] p-8 shadow-2xl space-y-5"
      >
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/25">
          <Lock size={32} />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-white tracking-tight">
            This Playlist is Private
          </h2>
          <p className="text-xs text-zinc-400 leading-relaxed">
            The creator of this playlist has set its privacy to Private. Ask the owner to switch it to <strong>"Share by link"</strong> or <strong>"Public"</strong>.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <Link
            href="/playlists"
            className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-black font-bold text-xs hover:bg-primary/90 transition-all text-center"
          >
            Browse Playlists
          </Link>
          <Link
            href="/home"
            className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-800 text-zinc-200 font-semibold text-xs hover:bg-zinc-700 transition-all text-center border border-zinc-700"
          >
            Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};
