"use client";

import React, { useRef, useEffect } from "react";
import { useStore } from "@tanstack/react-store";
import { playerStore } from "@/store/player.store";

interface AudioVisualizerFallbackProps {
  analyser?: AnalyserNode | null;
  isPlaying: boolean;
}

export const AudioVisualizerFallback: React.FC<AudioVisualizerFallbackProps> = ({
  analyser,
  isPlaying,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastDataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const currentSong = useStore(playerStore, (s) => s.currentSong);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser ? analyser.frequencyBinCount : 64;
    if (
      !lastDataArrayRef.current ||
      lastDataArrayRef.current.length !== bufferLength
    ) {
      const initialArray: Uint8Array<ArrayBuffer> = new Uint8Array(
        new ArrayBuffer(bufferLength),
      );
      for (let i = 0; i < bufferLength; i++) {
        initialArray[i] = 16;
      }
      lastDataArrayRef.current = initialArray;
    }
    const dataArray = lastDataArrayRef.current;

    const render = () => {
      const width = rect.width;
      const height = rect.height;

      ctx.clearRect(0, 0, width, height);

      // When playing, capture live frequency data. When paused, maintain exact current state.
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray);
      }

      // Live 46-band stereo equalizer spectrum
      const barCount = 46;
      const spacing = 6;
      const totalSpacing = spacing * (barCount - 1);
      const barWidth = Math.max(2, (width - totalSpacing) / barCount);

      for (let i = 0; i < barCount; i++) {
        const index = Math.floor((i / barCount) * (bufferLength * 0.75));
        const value = dataArray[index] || 0;
        const percent = Math.min(1, value / 255);
        const barHeight = Math.max(4, percent * height * 0.92);
        const x = i * (barWidth + spacing);
        const y = height - barHeight;

        // Solid color bars
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, [3, 3, 3, 3]);
        ctx.fill();
      }

      if (isPlaying) {
        animationFrameRef.current = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [analyser, isPlaying]);

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-8 w-full max-w-3xl my-auto px-4">
      {/* Live Equalizer Canvas */}
      <div className="relative w-full overflow-hidden flex items-center justify-center">
        <canvas ref={canvasRef} className="w-full h-52 sm:h-64 block" />
      </div>

      {/* Info Badge */}
      <div className="text-center space-y-1.5">
        <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
          {currentSong?.title || "Audio Melody"}
        </h3>
        <p className="text-xs font-semibold text-white/70 tracking-wide uppercase">
          {isPlaying ? "Live Audio Spectrum Visualizer" : "Playback Paused"}
        </p>
      </div>
    </div>
  );
};
