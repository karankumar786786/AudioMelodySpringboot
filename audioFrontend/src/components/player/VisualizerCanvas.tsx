"use client";

import React, { useEffect, useRef } from "react";

interface VisualizerCanvasProps {
  analyser: AnalyserNode | null;
  isPlaying: boolean;
  className?: string;
}

export function VisualizerCanvas({
  analyser,
  isPlaying,
  className = "w-full h-32",
}: VisualizerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      } else {
        // Idle gentle wave animation when paused or no audio
        const time = Date.now() * 0.002;
        for (let i = 0; i < bufferLength; i++) {
          dataArray[i] = Math.sin(time + i * 0.15) * 12 + 18;
        }
      }

      // Flat Clean White Bars Spectrum
      const barCount = 36;
      const spacing = 3.5;
      const totalSpacing = spacing * (barCount - 1);
      const barWidth = (width - totalSpacing) / barCount;

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor((i / barCount) * (bufferLength * 0.7));
        const value = dataArray[index] || 0;
        const percent = value / 255;
        const barHeight = Math.max(3, percent * height * 0.9);
        const x = i * (barWidth + spacing);
        const y = height - barHeight;

        // White gradient
        const grad = ctx.createLinearGradient(0, height, 0, y);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.15)");
        grad.addColorStop(0.6, "rgba(255, 255, 255, 0.65)");
        grad.addColorStop(1, "#ffffff");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        ctx.fill();

        // White glowing cap
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(x, Math.max(0, y - 2), barWidth, 1.5, 0.75);
        ctx.fill();
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-black/60 border border-white/10 p-3 shadow-inner">
      <canvas
        ref={canvasRef}
        className={`${className} block w-full rounded-lg`}
      />
    </div>
  );
}
