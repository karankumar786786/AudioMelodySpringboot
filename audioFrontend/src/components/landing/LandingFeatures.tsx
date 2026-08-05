"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  Search,
  Sliders,
  ListMusic,
  Headphones,
  RadioTower,
  Lock,
  Globe,
  Sparkles,
} from "lucide-react";
import { Interactive3DTiltCard } from "./Interactive3DTiltCard";

// ── Shared dark card style ──────────────────────────────────────
const card: React.CSSProperties = {
  background:
    "linear-gradient(160deg, rgba(16,18,16,0.95) 0%, rgba(10,12,10,0.98) 100%)",
  border: "1px solid rgba(255,255,255,0.07)",
  boxShadow:
    "0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 48px rgba(0,0,0,0.40)",
};

const innerPanel: React.CSSProperties = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "0.875rem",
};

function IconBox({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-9 h-9 rounded-xl flex items-center justify-center text-primary shrink-0"
      style={{
        background: "rgba(120,240,142,0.10)",
        border: "1px solid rgba(120,240,142,0.18)",
      }}
    >
      {children}
    </div>
  );
}

// ── Demos ───────────────────────────────────────────────────────

function SegmentStreamerDemo() {
  const [segments, setSegments] = useState([
    { name: "Segment 1", status: "loaded", size: "840KB" },
    { name: "Segment 2", status: "loaded", size: "910KB" },
    { name: "Segment 3", status: "buffering", size: "780KB" },
    { name: "Segment 4", status: "idle", size: "820KB" },
    { name: "Segment 5", status: "idle", size: "850KB" },
  ]);

  useEffect(() => {
    const id = setInterval(() => {
      setSegments((prev) => {
        const bi = prev.findIndex((s) => s.status === "buffering");
        if (bi === -1)
          return prev.map((s, i) => ({
            ...s,
            status: i === 0 ? "buffering" : "idle",
          }));
        return prev.map((s, i) => {
          if (i === bi) return { ...s, status: "loaded" };
          if (i === (bi + 1) % prev.length)
            return { ...s, status: "buffering" };
          if (i > (bi + 1) % prev.length && i !== bi)
            return { ...s, status: "idle" };
          return s;
        });
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-2 w-full max-w-[270px] p-3.5" style={innerPanel}>
      <div className="flex items-center justify-between text-[8px] font-bold uppercase tracking-widest text-zinc-600 mb-1">
        <span>HLS Buffer Queue</span>
        <span className="text-primary animate-pulse">Live</span>
      </div>
      {segments.map((seg, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-3 py-1.5 rounded-lg text-[10px] transition-all duration-300"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.05)",
          }}
        >
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                seg.status === "loaded"
                  ? "bg-primary shadow-[0_0_6px_var(--primary)]"
                  : seg.status === "buffering"
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-zinc-700"
              }`}
            />
            <span
              className={`font-medium ${seg.status === "idle" ? "text-zinc-600" : "text-zinc-300"}`}
            >
              {seg.name}
            </span>
          </div>
          <div className="flex items-center gap-1.5 font-mono text-[8px] text-zinc-600">
            <span>{seg.size}</span>
            <span
              className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase ${
                seg.status === "loaded"
                  ? "bg-primary/10 text-primary"
                  : seg.status === "buffering"
                    ? "bg-emerald-400/10 text-emerald-400"
                    : "bg-zinc-800 text-zinc-600"
              }`}
            >
              {seg.status}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function OtpDemo() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState("idle");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      while (mounted) {
        setStatus("typing");
        const target = ["7", "2", "0", "9", "4", "5"];
        for (let i = 0; i < 6; i++) {
          if (!mounted) return;
          await new Promise((r) => setTimeout(r, 450));
          setDigits((p) => {
            const n = [...p];
            n[i] = target[i];
            return n;
          });
        }
        if (!mounted) return;
        await new Promise((r) => setTimeout(r, 300));
        setStatus("success");
        await new Promise((r) => setTimeout(r, 2200));
        if (!mounted) return;
        setDigits(["", "", "", "", "", ""]);
        await new Promise((r) => setTimeout(r, 600));
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-3 p-3.5 w-full max-w-[200px] mx-auto"
      style={innerPanel}
    >
      <div className="flex gap-1.5">
        {digits.map((d, i) => (
          <div
            key={i}
            className={`w-7 h-9 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
              status === "success"
                ? "border border-primary text-primary bg-primary/5"
                : d
                  ? "border border-zinc-700 text-white bg-white/5"
                  : "border border-zinc-800 bg-zinc-900/60 text-zinc-700"
            }`}
          >
            {d}
          </div>
        ))}
      </div>
      {status === "success" ? (
        <div className="flex items-center gap-1 text-[8px] font-bold text-primary uppercase tracking-widest">
          <Check className="w-3 h-3" /> HMAC Verified
        </div>
      ) : (
        <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest animate-pulse">
          {status === "typing" ? "Hashing OTP..." : "Awaiting..."}
        </span>
      )}
    </div>
  );
}

function SearchDemo() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(false);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      while (mounted) {
        const text = "Tame Impala";
        setQuery("");
        setResult(false);
        await new Promise((r) => setTimeout(r, 800));
        for (let i = 0; i <= text.length; i++) {
          if (!mounted) return;
          setQuery(text.substring(0, i));
          await new Promise((r) => setTimeout(r, 140));
        }
        if (!mounted) return;
        await new Promise((r) => setTimeout(r, 400));
        setResult(true);
        await new Promise((r) => setTimeout(r, 3000));
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className="w-full max-w-[200px] mx-auto p-3.5 space-y-2"
      style={innerPanel}
    >
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 text-[10px]">
        <Search size={10} className="text-zinc-600 shrink-0" />
        <div className="text-zinc-300 font-medium truncate border-r border-primary pr-0.5 animate-pulse min-h-[14px]">
          {query || <span className="text-zinc-700">Search library...</span>}
        </div>
      </div>
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="p-2 rounded-lg flex items-center gap-2"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="w-7 h-7 rounded bg-zinc-800 shrink-0 overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&q=80&w=60"
                className="w-full h-full object-cover"
                alt=""
              />
            </div>
            <div>
              <h4 className="text-[9px] font-bold text-white uppercase">
                Let It Happen
              </h4>
              <p className="text-[7px] text-zinc-500 uppercase tracking-wider">
                Tame Impala
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function EqualizerDemo() {
  const [preset, setPreset] = useState<"boost" | "vocal" | "acoustic">("boost");
  const heights = {
    boost: [20, 50, 75, 95, 80, 55, 35, 25, 15, 10],
    vocal: [8, 15, 35, 55, 85, 95, 75, 50, 30, 15],
    acoustic: [18, 38, 50, 58, 62, 68, 72, 58, 42, 28],
  };
  return (
    <div
      className="flex flex-col sm:flex-row gap-3 items-center w-full max-w-xs p-3.5"
      style={innerPanel}
    >
      <div className="flex sm:flex-col gap-1.5 shrink-0 w-full sm:w-auto">
        {(["boost", "vocal", "acoustic"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPreset(p)}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-[8px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
              preset === p
                ? "bg-primary text-black"
                : "text-zinc-500 hover:text-white border border-zinc-800"
            }`}
            style={preset !== p ? { background: "rgba(255,255,255,0.03)" } : {}}
          >
            {p === "boost" ? "Bass" : p === "vocal" ? "Vocal" : "Acoustic"}
          </button>
        ))}
      </div>
      <div
        className="flex gap-1 items-end justify-center w-full h-16 rounded-lg p-2.5"
        style={{
          background: "rgba(0,0,0,0.30)",
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {heights[preset].map((h, i) => (
          <motion.div
            key={i}
            animate={{
              height: [`${h * 0.3}%`, `${h}%`, `${h * 0.5}%`, `${h * 0.3}%`],
            }}
            transition={{
              repeat: Infinity,
              duration: 1.1 + (i % 3) * 0.25,
              ease: "easeInOut",
            }}
            className="rounded-full flex-1"
            style={{
              background:
                "linear-gradient(to top, rgba(120,240,142,0.6), #34d399)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function PlaylistDemo() {
  const [playlists, setPlaylists] = useState([
    { name: "Late Night Beats", count: 14 },
    { name: "Acoustic Session", count: 9 },
  ]);
  const [typing, setTyping] = useState(false);
  const [val, setVal] = useState("");

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      while (mounted) {
        await new Promise((r) => setTimeout(r, 1600));
        setTyping(true);
        const name = "Dark Ambient";
        for (let i = 0; i <= name.length; i++) {
          if (!mounted) return;
          setVal(name.substring(0, i));
          await new Promise((r) => setTimeout(r, 130));
        }
        await new Promise((r) => setTimeout(r, 500));
        if (!mounted) return;
        setPlaylists((p) => [...p, { name: "Dark Ambient", count: 0 }]);
        setVal("");
        setTyping(false);
        await new Promise((r) => setTimeout(r, 3800));
        if (!mounted) return;
        setPlaylists([
          { name: "Late Night Beats", count: 14 },
          { name: "Acoustic Session", count: 9 },
        ]);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className="w-full max-w-[200px] mx-auto p-3.5 space-y-2"
      style={innerPanel}
    >
      <div className="flex justify-between text-[8px] font-bold uppercase tracking-wider text-zinc-600">
        <span>My Playlists</span>
        <span className="w-4 h-4 rounded-full bg-primary/15 text-primary flex items-center justify-center cursor-pointer hover:bg-primary hover:text-black transition-colors text-xs">
          +
        </span>
      </div>
      {playlists.map((pl) => (
        <motion.div
          layout
          key={pl.name}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <ListMusic size={10} className="text-primary" />
            <span className="font-medium text-zinc-300">{pl.name}</span>
          </div>
          <span className="text-[7px] font-mono text-zinc-600">
            {pl.count} tracks
          </span>
        </motion.div>
      ))}
      {typing && (
        <div
          className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[10px]"
          style={{
            background: "rgba(120,240,142,0.05)",
            border: "1px solid rgba(120,240,142,0.18)",
          }}
        >
          <div className="flex items-center gap-1.5">
            <ListMusic size={10} className="text-primary animate-pulse" />
            <span className="font-medium text-primary border-r border-primary pr-0.5 animate-pulse">
              {val}
            </span>
          </div>
          <span className="text-[7px] font-bold text-primary uppercase">
            Typing
          </span>
        </div>
      )}
    </div>
  );
}

function RecommendationDemo() {
  const genres = [
    { name: "Synthwave", x: 10, y: 18 },
    { name: "Indie Rock", x: 72, y: 13 },
    { name: "Ambient", x: 15, y: 70 },
    { name: "Lo-Fi", x: 75, y: 66 },
  ];
  return (
    <div
      className="relative w-full max-w-[200px] h-28 mx-auto overflow-hidden flex items-center justify-center"
      style={innerPanel}
    >
      <div
        className="absolute w-8 h-8 rounded-full flex items-center justify-center z-20"
        style={{
          background: "rgba(120,240,142,0.10)",
          border: "1px solid rgba(120,240,142,0.25)",
          boxShadow: "0 0 16px rgba(120,240,142,0.15)",
        }}
      >
        <Headphones size={12} className="text-primary animate-pulse" />
      </div>
      <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
        {[
          [50, 50, 25, 28],
          [50, 50, 78, 23],
          [50, 50, 30, 70],
          [50, 50, 78, 68],
        ].map(([x1, y1, x2, y2], i) => (
          <line
            key={i}
            x1={`${x1}%`}
            y1={`${y1}%`}
            x2={`${x2}%`}
            y2={`${y2}%`}
            stroke="rgba(120,240,142,0.18)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ))}
      </svg>
      {genres.map((g, i) => (
        <motion.div
          key={i}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ repeat: Infinity, duration: 2 + i * 0.4 }}
          className="absolute px-2 py-0.5 rounded-full text-[7px] font-bold uppercase tracking-wider text-zinc-400 z-20"
          style={{
            left: `${g.x}%`,
            top: `${g.y}%`,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(120,240,142,0.25)",
          }}
        >
          {g.name}
        </motion.div>
      ))}
    </div>
  );
}

// ── Main Section ────────────────────────────────────────────────

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="max-w-6xl mx-auto px-6 py-24 relative z-10"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="text-center space-y-2 mb-16">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
          Capabilities
        </p>
        <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white">
          Asymmetric Hardware.
          <br />
          <span className="text-zinc-600 font-light">Precise Delivery.</span>
        </h2>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-8">
          <Interactive3DTiltCard
            className="h-full rounded-[1.75rem] p-7 flex flex-col md:flex-row gap-7 items-center justify-between group hover:border-primary/10 transition-all duration-300"
            style={card}
          >
            <div className="space-y-3 text-left max-w-xs">
              <IconBox>
                <RadioTower className="w-4 h-4" />
              </IconBox>
              <h3 className="text-xl font-black text-white tracking-tight">
                Adaptive HLS Segmenting
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Audio tracks packaged as{" "}
                <code className="text-primary text-xs">.m3u8</code> segments.
                Failsafe buffers recover drops automatically.
              </p>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <SegmentStreamerDemo />
            </div>
          </Interactive3DTiltCard>
        </div>

        <div className="col-span-12 md:col-span-4">
          <Interactive3DTiltCard
            className="h-full rounded-[1.75rem] p-7 flex flex-col justify-between gap-5 group hover:border-primary/10 transition-all duration-300"
            style={card}
          >
            <IconBox>
              <Lock className="w-4 h-4" />
            </IconBox>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">
                HMAC OTP Security
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Passwordless HMAC-signed passcode nodes cached in ioredis.
              </p>
            </div>
            <OtpDemo />
          </Interactive3DTiltCard>
        </div>

        <div className="col-span-12 md:col-span-4">
          <Interactive3DTiltCard
            className="h-full rounded-[1.75rem] p-7 flex flex-col justify-between gap-5 group hover:border-primary/10 transition-all duration-300"
            style={card}
          >
            <IconBox>
              <Globe className="w-4 h-4" />
            </IconBox>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">
                Algolia Catalog
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Global music archive with fuzzy search and instant autocomplete.
              </p>
            </div>
            <SearchDemo />
          </Interactive3DTiltCard>
        </div>

        <div className="col-span-12 md:col-span-8">
          <Interactive3DTiltCard
            className="h-full rounded-[1.75rem] p-7 flex flex-col md:flex-row gap-7 items-center justify-between group hover:border-primary/10 transition-all duration-300"
            style={card}
          >
            <div className="space-y-3 text-left max-w-xs">
              <IconBox>
                <Sliders className="w-4 h-4" />
              </IconBox>
              <h3 className="text-xl font-black text-white tracking-tight">
                Lossless Custom EQ
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Bass Boost, Vocal Clarifier, and Acoustic preset equalizers.
              </p>
            </div>
            <div className="shrink-0 w-full md:w-auto">
              <EqualizerDemo />
            </div>
          </Interactive3DTiltCard>
        </div>

        <div className="col-span-12 md:col-span-6">
          <Interactive3DTiltCard
            className="h-full rounded-[1.75rem] p-7 flex flex-col justify-between gap-5 group hover:border-primary/10 transition-all duration-300"
            style={card}
          >
            <IconBox>
              <ListMusic className="w-4 h-4" />
            </IconBox>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">
                Synchronized Playlists
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                One-click track addition writing metadata directly to schema.
              </p>
            </div>
            <PlaylistDemo />
          </Interactive3DTiltCard>
        </div>

        <div className="col-span-12 md:col-span-6">
          <Interactive3DTiltCard
            className="h-full rounded-[1.75rem] p-7 flex flex-col justify-between gap-5 group hover:border-primary/10 transition-all duration-300"
            style={card}
          >
            <IconBox>
              <Sparkles className="w-4 h-4" />
            </IconBox>
            <div className="space-y-2">
              <h3 className="text-xl font-black text-white tracking-tight">
                AI Curation Clusters
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Acoustic pattern discovery suggesting listening spheres.
              </p>
            </div>
            <RecommendationDemo />
          </Interactive3DTiltCard>
        </div>
      </div>
    </section>
  );
}
