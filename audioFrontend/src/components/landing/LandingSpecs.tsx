"use client";

import { Cpu, Layers3, Radio, Server } from "lucide-react";
import type React from "react";

const card: React.CSSProperties = {
  background:
    "linear-gradient(160deg, rgba(16,18,16,0.95) 0%, rgba(10,12,10,0.98) 100%)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 48px rgba(0,0,0,0.40)",
};

export function LandingSpecs() {
  return (
    <section
      id="specs"
      className="max-w-6xl mx-auto px-6 py-24 relative z-10"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="text-center space-y-2 mb-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
          Technical Specifications
        </p>
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
          Engineering Topology
        </h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Metrics table */}
        <div
          className="lg:col-span-5 rounded-[1.75rem] p-8 flex flex-col justify-between"
          style={card}
        >
          <div>
            <h3 className="text-lg font-black text-white mb-6 tracking-tight">
              Metrics Comparison
            </h3>
            <div className="space-y-0 divide-y divide-white/5">
              {[
                {
                  label: "Stream Latency",
                  value: "Sub-100ms",
                  highlight: true,
                },
                {
                  label: "Audio Format",
                  value: "320kbps FLAC / AAC",
                  highlight: false,
                },
                {
                  label: "Session Cache",
                  value: "ioredis Memory",
                  highlight: false,
                },
                {
                  label: "Database",
                  value: "Neon PG Serverless",
                  highlight: true,
                },
                {
                  label: "Delivery",
                  value: "AWS S3 Edge CDN",
                  highlight: false,
                },
              ].map(({ label, value, highlight }) => (
                <div
                  key={label}
                  className="flex justify-between items-center py-3.5"
                >
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    {label}
                  </span>
                  <span
                    className={`text-xs font-black uppercase tracking-wider ${highlight ? "text-primary shadow-[0_0_12px_rgba(120,240,142,0.15)]" : "text-zinc-300"}`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Architecture */}
        <div
          className="lg:col-span-7 rounded-[1.75rem] p-8 flex flex-col"
          style={card}
        >
          <h3 className="text-lg font-black text-white tracking-tight mb-1">
            Architectural Blueprint
          </h3>
          <p className="text-zinc-500 text-sm mb-8 leading-relaxed">
            How media and tokens travel across our hybrid edge serverless stack.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-auto">
            {[
              { Icon: Cpu, title: "Transcode", sub: "HLS Packaging" },
              { Icon: Server, title: "S3 Storage", sub: "AWS Edge" },
              { Icon: Layers3, title: "ioredis", sub: "Session Cache" },
              { Icon: Radio, title: "Hls.js", sub: "Decoded Live" },
            ].map(({ Icon, title, sub }) => (
              <div
                key={title}
                className="p-4 rounded-xl flex flex-col items-center gap-2.5 text-center transition-all duration-300 hover:border-white/10"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center animate-pulse"
                  style={{
                    background: "rgba(120,240,142,0.10)",
                    border: "1px solid rgba(120,240,142,0.18)",
                  }}
                >
                  <Icon size={14} className="text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-zinc-200">{title}</h4>
                  <p className="text-[9px] text-zinc-500 uppercase tracking-wider mt-0.5">
                    {sub}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
