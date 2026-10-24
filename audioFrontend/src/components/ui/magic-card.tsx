"use client";

import React, { useCallback, useEffect, useRef } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
} from "framer-motion";
import { cn } from "@/lib/utils";

interface MagicCardProps {
  children?: React.ReactNode;
  className?: string;
  gradientSize?: number;
  gradientColor?: string;
  gradientOpacity?: number;
  gradientFrom?: string;
  gradientTo?: string;
  mode?: "gradient" | "orb";
  glowFrom?: string;
  glowTo?: string;
  glowSize?: number;
  glowBlur?: number;
  glowOpacity?: number;
}

export function MagicCard({
  children,
  className,
  gradientSize = 250,
  gradientColor = "rgba(255, 255, 255, 0.08)",
  gradientOpacity = 0.8,
  gradientFrom = "#1ed760",
  gradientTo = "#3b82f6",
  mode = "gradient",
  glowFrom = "#1ed760",
  glowTo = "#6366f1",
  glowSize = 350,
  glowBlur = 50,
  glowOpacity = 0.6,
}: MagicCardProps) {
  const mouseX = useMotionValue(-gradientSize);
  const mouseY = useMotionValue(-gradientSize);

  const orbX = useSpring(mouseX, { stiffness: 250, damping: 30, mass: 0.6 });
  const orbY = useSpring(mouseY, { stiffness: 250, damping: 30, mass: 0.6 });
  const orbVisible = useSpring(0, { stiffness: 300, damping: 35 });

  const reset = useCallback(() => {
    if (mode === "orb") {
      orbVisible.set(0);
      return;
    }
    const off = -gradientSize;
    mouseX.set(off);
    mouseY.set(off);
  }, [gradientSize, mode, mouseX, mouseY, orbVisible]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      mouseX.set(e.clientX - rect.left);
      mouseY.set(e.clientY - rect.top);
      if (mode === "orb") {
        orbVisible.set(glowOpacity);
      }
    },
    [glowOpacity, mode, mouseX, mouseY, orbVisible]
  );

  return (
    <motion.div
      className={cn(
        "group relative isolate overflow-hidden rounded-2xl border border-white/10 bg-[#121212]/90 backdrop-blur-md transition-shadow duration-300",
        className
      )}
      onPointerMove={handlePointerMove}
      onPointerLeave={reset}
    >
      {/* Dynamic Cursor Spotlight Border */}
      <motion.div
        className="pointer-events-none absolute -inset-px z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`
            radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
              ${gradientFrom},
              ${gradientTo},
              transparent 80%
            )
          `,
          maskImage:
            "linear-gradient(black, black) content-box, linear-gradient(black, black)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1px",
        }}
      />

      {/* Surface Radial Shine */}
      {mode === "gradient" && (
        <motion.div
          className="pointer-events-none absolute inset-0 z-10 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(${gradientSize}px circle at ${mouseX}px ${mouseY}px,
                ${gradientColor},
                transparent 100%
              )
            `,
            opacity: gradientOpacity,
          }}
        />
      )}

      {/* Orb Mode */}
      {mode === "orb" && (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute z-10"
          style={{
            width: glowSize,
            height: glowSize,
            x: orbX,
            y: orbY,
            translateX: "-50%",
            translateY: "-50%",
            borderRadius: 9999,
            filter: `blur(${glowBlur}px)`,
            opacity: orbVisible,
            background: `radial-gradient(circle, ${glowFrom}, ${glowTo}, transparent 70%)`,
            mixBlendMode: "screen",
          }}
        />
      )}

      <div className="relative z-20 h-full w-full">{children}</div>
    </motion.div>
  );
}
