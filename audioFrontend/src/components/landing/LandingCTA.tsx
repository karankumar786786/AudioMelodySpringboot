"use client";

import React from "react";
import { ArrowRight } from "lucide-react";
import { playerActions } from "@/store/player.store";

export function LandingCTA() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-12 z-10 relative">
      <div
        className="rounded-[2rem] px-10 py-16 md:py-20 text-center relative overflow-hidden"
        style={{
          background: "rgba(10,11,10,0.96)",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 32px 80px rgba(0,0,0,0.28)",
        }}
      >
        {/* Subtle green glow */}
        <div
          className="absolute inset-0 rounded-[2rem] pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(120,240,142,0.12), transparent 70%)",
          }}
        />

        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary mb-4 relative z-10">
          Start Listening
        </p>
        <h2 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight mb-4 relative z-10">
          Hear the Difference.
        </h2>
        <p className="text-zinc-500 text-base max-w-sm mx-auto mb-8 leading-relaxed relative z-10">
          Create an account with your email and access personalized, buffer-free
          audio anywhere.
        </p>
        <div className="relative z-10">
          <button
            onClick={() => playerActions.openAuthModal()}
            className="inline-flex items-center gap-2 px-8 py-4 bg-primary text-black rounded-xl font-bold text-sm hover:brightness-110 transition-all active:scale-95 cursor-pointer group"
            style={{ boxShadow: "0 4px 20px rgba(120,240,142,0.30)" }}
          >
            Get Started Free
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </section>
  );
}
