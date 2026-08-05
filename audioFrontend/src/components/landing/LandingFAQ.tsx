"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";

const faqs = [
  {
    q: "What is Adaptive HLS Audio Streaming?",
    a: "Adaptive HTTP Live Streaming (HLS) breaks audio files into short segments distributed via .m3u8 playlists. The player monitors network performance and seamlessly switches bitrates (128kbps → 320kbps FLAC) to guarantee zero buffering.",
  },
  {
    q: "Can I create my own playlists and add songs?",
    a: "Yes. Once logged in, create and manage playlists with one click. Reorder tracks, manage your queue, and save favorites — all synced to your account instantly.",
  },
  {
    q: "How does passwordless OTP verification work?",
    a: "We send a 6-digit HMAC-signed passcode to your email. Enter it on the platform — it expires in 5 minutes. No passwords, no risk.",
  },
  {
    q: "Is my streaming synced across devices?",
    a: "Absolutely. Favorites, playlists, and listening history are linked to your account and sync seamlessly across all devices.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="py-4"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-left cursor-pointer group"
      >
        <span className="text-sm font-bold text-zinc-300 group-hover:text-white transition-colors pr-6">
          {question}
        </span>
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
          style={{
            background: open ? "var(--primary)" : "rgba(255,255,255,0.06)",
          }}
        >
          {open ? (
            <Minus className="w-3 h-3 text-black" />
          ) : (
            <Plus className="w-3 h-3 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
          )}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="text-zinc-500 text-xs mt-3 leading-relaxed pr-8">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function LandingFAQ() {
  return (
    <section
      id="faq"
      className="max-w-3xl mx-auto px-6 py-24 relative z-10"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="text-center space-y-2 mb-12">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary">
          FAQ
        </p>
        <h2 className="text-4xl font-black tracking-tight text-white">
          Common Questions
        </h2>
      </div>
      <div
        className="rounded-[1.75rem] px-6 py-2"
        style={{
          background:
            "linear-gradient(160deg, rgba(16,18,16,0.95) 0%, rgba(10,12,10,0.98) 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow:
            "0 1px 0 rgba(255,255,255,0.04) inset, 0 16px 48px rgba(0,0,0,0.40)",
        }}
      >
        {faqs.map((f) => (
          <FAQItem key={f.q} question={f.q} answer={f.a} />
        ))}
      </div>
    </section>
  );
}
