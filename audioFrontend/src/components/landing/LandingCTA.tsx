"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { playerActions } from "@/store/player.store";

export function LandingCTA() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 z-10 relative">
      <div
        className="rounded-xl px-10 py-16 text-center relative overflow-hidden bg-[#181818] border border-[#282828] shadow-2xl"
      >
        <p className="text-xs font-semibold text-primary mb-3 relative z-10">
          Ready to listen?
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight leading-tight mb-4 relative z-10">
          Stream your favorite music today.
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto mb-8 leading-relaxed relative z-10">
          Create a free account with your email and enjoy high-fidelity audio with synchronized lyrics anywhere.
        </p>
        <div className="relative z-10">
          <button
            onClick={() => playerActions.openAuthModal()}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-primary text-black rounded-full font-bold text-sm hover:scale-105 transition-all cursor-pointer group shadow-md"
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
}
