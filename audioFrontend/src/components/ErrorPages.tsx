"use client";

import React, { useEffect, useState } from "react";
import { WifiOff, ServerCrash, AlertCircle, SearchX, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

/* ─── Spotify / One Melody Shared Error Container ────────────────── */
interface ErrorShellProps {
  icon: React.ReactNode;
  badge?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}

const ErrorShell: React.FC<ErrorShellProps> = ({
  icon,
  badge,
  title,
  description,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] w-full text-center px-6 select-none animate-[fadeSlideIn_0.4s_ease-out]">
      {/* Icon in Spotify-dark container */}
      <div className="w-20 h-20 rounded-full bg-[#181818] border border-[#282828] flex items-center justify-center mb-6 shadow-xl text-white">
        {icon}
      </div>

      {/* Badge / Error code if applicable */}
      {badge && (
        <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#181818] border border-[#282828] text-xs font-mono text-zinc-400 mb-3">
          {badge}
        </span>
      )}

      {/* Main Title */}
      <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight mb-2">
        {title}
      </h1>

      {/* Subtitle / Description */}
      <p className="text-sm font-medium text-zinc-400 leading-relaxed mb-8 max-w-md">
        {description}
      </p>

      {/* Action Buttons */}
      {action}
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   1. No Internet / Offline Page
   ═══════════════════════════════════════════════════════════════════════ */
export const OfflinePage: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`/manifest.webmanifest?probe=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (res.ok || res.status === 200 || res.status === 304) {
        window.location.reload();
        return;
      }
    } catch {
      // still offline
    }
    setTimeout(() => setIsChecking(false), 600);
  };

  useEffect(() => {
    const handleOnline = () => checkConnection();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  return (
    <ErrorShell
      icon={<WifiOff size={32} className="text-zinc-300" />}
      badge="Network Disconnected"
      title="No internet connection"
      description="You appear to be offline. Check your connection or Wi-Fi — we'll automatically reconnect the moment you're back."
      action={
        <button
          onClick={checkConnection}
          disabled={isChecking}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-black bg-white hover:bg-white/90 hover:scale-105 active:scale-95 disabled:opacity-60 transition-all shadow-md cursor-pointer"
        >
          <RotateCcw size={16} className={isChecking ? "animate-spin" : ""} />
          {isChecking ? "Checking..." : "Try Again"}
        </button>
      }
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   2. Internal Server Error (500) Page
   ═══════════════════════════════════════════════════════════════════════ */
export const ServerErrorPage: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <ErrorShell
      icon={<ServerCrash size={32} className="text-zinc-300" />}
      badge="Error 500"
      title="Something went wrong on our end"
      description="The server encountered an unexpected error while loading this content. Please try refreshing."
      action={
        <div className="flex items-center gap-3">
          <button
            onClick={onRetry ?? (() => window.location.reload())}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-black bg-white hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white bg-transparent hover:bg-white/10 border border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Home size={16} />
            Go to Home
          </Link>
        </div>
      }
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   3. Generic "Something Went Wrong" Page
   ═══════════════════════════════════════════════════════════════════════ */
export const SomethingWentWrongPage: React.FC<{
  error?: Error;
  reset?: () => void;
}> = ({ error, reset }) => {
  return (
    <ErrorShell
      icon={<AlertCircle size={32} className="text-zinc-300" />}
      badge="Application Error"
      title="Oops! Something went wrong"
      description={
        error?.message && !error.message.includes("Object")
          ? error.message.slice(0, 120)
          : "An unexpected error occurred while rendering this page. You can try refreshing or returning to Home."
      }
      action={
        <div className="flex items-center gap-3">
          <button
            onClick={reset ?? (() => window.location.reload())}
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-black bg-white hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
          >
            <RotateCcw size={16} />
            Try Again
          </button>
          <Link
            href="/home"
            className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-white bg-transparent hover:bg-white/10 border border-white/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <Home size={16} />
            Go to Home
          </Link>
        </div>
      }
    />
  );
};

/* ═══════════════════════════════════════════════════════════════════════
   4. Not Found (404) Page
   ═══════════════════════════════════════════════════════════════════════ */
export const NotFoundPage: React.FC = () => {
  return (
    <ErrorShell
      icon={<SearchX size={32} className="text-zinc-300" />}
      badge="Error 404"
      title="Page not found"
      description="We couldn't find the page, artist, or playlist you're looking for. It may have been removed or the URL is invalid."
      action={
        <Link
          href="/home"
          className="inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold text-black bg-white hover:bg-white/90 hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer"
        >
          <Home size={16} />
          Explore Home
        </Link>
      }
    />
  );
};
