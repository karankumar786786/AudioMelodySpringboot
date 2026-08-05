"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { playerStore } from "@/store/player.store";
import { useStore } from "@tanstack/react-store";

// Modularized landing components
import { BackgroundBlob } from "@/components/landing/BackgroundBlob";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingFeatures } from "@/components/landing/LandingFeatures";
import { LandingSpecs } from "@/components/landing/LandingSpecs";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingFooter } from "@/components/landing/LandingFooter";

export default function Home() {
  const systemUser = useStore(playerStore, (s) => s.systemUser);
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (isMounted && systemUser) {
      router.push("/home");
    }
  }, [isMounted, systemUser, router]);

  if (!isMounted || systemUser) {
    return (
      <div className="flex items-center justify-center min-h-screen landing-bg">
        <div className="animate-pulse text-zinc-600 font-semibold text-sm tracking-[0.25em] uppercase italic">
          Initializing Soundscape...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen landing-bg text-white selection:bg-primary/20 overflow-y-auto relative font-sans no-scrollbar pb-16">
      {/* Very subtle dark grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none z-0" />

      {/* Single soft green glow — top only */}
      <BackgroundBlob
        className="top-[-8%] left-[10%] w-[60%] h-[40%] bg-primary/10"
        delay={0}
      />
      <BackgroundBlob
        className="bottom-[-5%] right-[5%] w-[40%] h-[35%] bg-primary/6"
        delay={6}
      />

      {/* Navbar */}
      <LandingNavbar />

      {/* Hero & Interactive Mock Player */}
      <LandingHero />

      {/* Capabilities Spec Bento Grid */}
      <LandingFeatures />

      {/* Spec sheet comparison and Topology blueprints */}
      <LandingSpecs />

      {/* Support Enquiries FAQs */}
      <LandingFAQ />

      {/* CTA Get Started Callout */}
      <LandingCTA />

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
