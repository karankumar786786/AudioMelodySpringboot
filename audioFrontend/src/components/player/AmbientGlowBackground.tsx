"use client";

import React, { useEffect, useRef } from "react";

interface AmbientGlowBackgroundProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
}

export function AmbientGlowBackground({
  analyser,
  isPlaying,
  className = "",
}: AmbientGlowBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number>(0);
  const bassEnergyRef = useRef<number>(0);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser ? analyser.frequencyBinCount : 32;
    if (!dataArrayRef.current || dataArrayRef.current.length !== bufferLength) {
      dataArrayRef.current = new Uint8Array(new ArrayBuffer(bufferLength));
    }
    const dataArray = dataArrayRef.current;

    let time = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;

      let instantBass = 0;
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
        // Sample low frequency bins (0 to 6 = ~20Hz to 160Hz)
        let sum = 0;
        const bassBinCount = Math.min(8, bufferLength);
        for (let i = 0; i < bassBinCount; i++) {
          sum += dataArray[i] || 0;
        }
        instantBass = sum / (bassBinCount * 255);
      }

      // Smooth bass smoothing
      bassEnergyRef.current = bassEnergyRef.current * 0.82 + instantBass * 0.18;
      const bass = bassEnergyRef.current;

      ctx.clearRect(0, 0, width, height);

      time += isPlaying ? 0.015 : 0.003;

      // Dynamic center positions
      const cx1 = width * (0.35 + Math.sin(time * 0.8) * 0.12);
      const cy1 = height * (0.45 + Math.cos(time * 0.6) * 0.12);

      const cx2 = width * (0.65 + Math.cos(time * 0.7) * 0.12);
      const cy2 = height * (0.55 + Math.sin(time * 0.9) * 0.12);

      const baseRadius = Math.min(width, height) * 0.45;
      const dynamicRadius = baseRadius * (1 + bass * 0.35);

      // Glow Orb 1 (Primary Cyan/Teal/Indigo)
      const grad1 = ctx.createRadialGradient(cx1, cy1, 10, cx1, cy1, dynamicRadius);
      const alpha1 = Math.min(0.35, 0.12 + bass * 0.25);
      grad1.addColorStop(0, `rgba(56, 189, 248, ${alpha1})`); // Sky Blue
      grad1.addColorStop(0.5, `rgba(99, 102, 241, ${alpha1 * 0.5})`); // Indigo
      grad1.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad1;
      ctx.fillRect(0, 0, width, height);

      // Glow Orb 2 (Accent Violet/Purple)
      const grad2 = ctx.createRadialGradient(cx2, cy2, 10, cx2, cy2, dynamicRadius * 1.1);
      const alpha2 = Math.min(0.30, 0.08 + bass * 0.22);
      grad2.addColorStop(0, `rgba(168, 85, 247, ${alpha2})`); // Purple
      grad2.addColorStop(0.6, `rgba(236, 72, 153, ${alpha2 * 0.4})`); // Pink
      grad2.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = grad2;
      ctx.fillRect(0, 0, width, height);

      animFrameRef.current = requestAnimationFrame(render);
    };

    // Resize canvas to match display size
    const updateSize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(100, rect.width * dpr);
      canvas.height = Math.max(100, rect.height * dpr);
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    animFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", updateSize);
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden select-none ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full h-full block opacity-70 filter blur-3xl transform-gpu will-change-transform"
      />
    </div>
  );
}
