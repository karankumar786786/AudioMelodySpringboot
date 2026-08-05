"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";

interface Interactive3DTiltCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Interactive3DTiltCard({
  children,
  className = "",
  style,
}: Interactive3DTiltCardProps) {
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glare, setGlare] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 10, y: -y * 10 });
    setGlare({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    setHovered(false);
  };

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      animate={{
        rotateY: tilt.x,
        rotateX: tilt.y,
        scale: hovered ? 1.015 : 1,
      }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      style={{
        transformStyle: "preserve-3d",
        perspective: 1200,
        ...style,
      }}
      className={`${className} cursor-pointer relative overflow-hidden`}
    >
      {hovered && (
        <div
          className="absolute inset-0 pointer-events-none rounded-[inherit] transition-opacity duration-300 opacity-20 z-30"
          style={{
            background: `radial-gradient(circle 180px at ${glare.x}px ${glare.y}px, rgba(255, 255, 255, 0.15), transparent)`,
          }}
        />
      )}
      <div
        style={{ transform: "translateZ(30px)" }}
        className="transition-transform duration-200 h-full w-full"
      >
        {children}
      </div>
    </motion.div>
  );
}
