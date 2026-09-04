"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Loader2 } from "lucide-react";

interface HeartButtonProps {
  isFavourite: boolean;
  onToggle: () => Promise<void> | void;
  size?: number;
  className?: string;
  disabled?: boolean;
}

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
}

const PARTICLE_COLORS = ["#22c55e", "#10b981", "#34d399", "#86efac", "#4ade80", "#ffffff"];

export const HeartButton: React.FC<HeartButtonProps> = ({
  isFavourite,
  onToggle,
  size = 18,
  className = "",
  disabled = false,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isBouncing, setIsBouncing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled || isLoading) return;

    const willBeFavourite = !isFavourite;

    if (willBeFavourite) {
      setIsBouncing(true);
      // Generate burst particles around the heart
      const newParticles: Particle[] = Array.from({ length: 8 }).map((_, i) => ({
        id: Date.now() + i,
        angle: (i * (360 / 8)) + (Math.random() * 20 - 10),
        distance: size * 1.2 + Math.random() * (size * 0.8),
        size: Math.max(3, size * 0.22 + (Math.random() * 2 - 1)),
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      }));
      setParticles(newParticles);
      setTimeout(() => setParticles([]), 700);
      setTimeout(() => setIsBouncing(false), 600);
    }

    try {
      setIsLoading(true);
      await onToggle();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || isLoading}
      aria-label={isFavourite ? "Remove from favourites" : "Save to favourites"}
      title={isFavourite ? "Remove from favourites" : "Save to favourites"}
      className={`relative inline-flex items-center justify-center p-1.5 rounded-full transition-colors cursor-pointer group select-none ${
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"
      } ${className}`}
    >
      {/* Particle Burst Overlay */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-visible z-20">
        <AnimatePresence>
          {particles.map((p) => {
            const rad = (p.angle * Math.PI) / 180;
            const targetX = Math.cos(rad) * p.distance;
            const targetY = Math.sin(rad) * p.distance;

            return (
              <motion.span
                key={p.id}
                initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                animate={{
                  x: targetX,
                  y: targetY,
                  scale: [0, 1.2, 0.4, 0],
                  opacity: [1, 1, 0.8, 0],
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.65, ease: "easeOut" }}
                style={{
                  width: p.size,
                  height: p.size,
                  backgroundColor: p.color,
                  boxShadow: `0 0 8px ${p.color}`,
                }}
                className="absolute rounded-full"
              />
            );
          })}
        </AnimatePresence>
      </div>

      {/* Pulsing ring shockwave on like */}
      <AnimatePresence>
        {isBouncing && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0.9 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="absolute rounded-full border-2 border-primary pointer-events-none w-full h-full"
          />
        )}
      </AnimatePresence>

      {/* Heart Icon with spring bounce */}
      {isLoading ? (
        <Loader2 size={size} className="animate-spin text-zinc-400" />
      ) : (
        <motion.div
          animate={
            isBouncing
              ? {
                  scale: [1, 0.6, 1.35, 0.9, 1.05, 1],
                  rotate: [0, -12, 12, -4, 0],
                }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.55, ease: "easeInOut" }}
          className="flex items-center justify-center"
        >
          <Heart
            size={size}
            className={`transition-colors duration-200 ${
              isFavourite
                ? "text-primary fill-primary filter drop-shadow-[0_0_6px_rgba(34,197,94,0.4)]"
                : "text-zinc-400 group-hover:text-white"
            }`}
          />
        </motion.div>
      )}
    </button>
  );
};
