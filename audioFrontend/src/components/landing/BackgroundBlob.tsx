"use client";

import React from "react";
import { motion } from "framer-motion";

interface BackgroundBlobProps {
  className: string;
  delay?: number;
}

export function BackgroundBlob({ className, delay = 0 }: BackgroundBlobProps) {
  return (
    <motion.div
      animate={{
        x: [0, 60, -40, 0],
        y: [0, -70, 50, 0],
        scale: [1, 1.2, 0.85, 1],
      }}
      transition={{
        duration: 20,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
      className={`absolute rounded-full blur-[180px] pointer-events-none opacity-20 ${className}`}
    />
  );
}
