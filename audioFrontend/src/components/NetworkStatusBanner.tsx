"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [showRestoredBadge, setShowRestoredBadge] = useState(false);
  const wasOfflineRef = useRef(false);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  // Active ping probe to test genuine internet connectivity
  const probeConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return false;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`/manifest.webmanifest?probe=${Date.now()}`, {
        method: "HEAD",
        cache: "no-store",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res.ok || res.status === 200 || res.status === 304;
    } catch {
      return false;
    }
  }, []);

  const handleManualRetry = async () => {
    setIsReconnecting(true);
    const reachable = await probeConnection();
    if (reachable) {
      setIsOnline(true);
      setIsReconnecting(false);
      if (wasOfflineRef.current) {
        setShowRestoredBadge(true);
        wasOfflineRef.current = false;
        setTimeout(() => setShowRestoredBadge(false), 2500);
      }
      queryClient.refetchQueries();
    } else {
      setIsOnline(false);
      wasOfflineRef.current = true;
      setIsReconnecting(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };

    const handleOnline = async () => {
      const reachable = await probeConnection();
      if (reachable) {
        setIsOnline(true);
        if (wasOfflineRef.current) {
          setShowRestoredBadge(true);
          wasOfflineRef.current = false;
          setTimeout(() => setShowRestoredBadge(false), 2500);
        }
        queryClient.refetchQueries();
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    // Initial check on mount
    if (!navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (retryTimerRef.current) clearInterval(retryTimerRef.current);
    };
  }, [probeConnection, queryClient]);

  // Periodic background retry when offline (every 4 seconds)
  useEffect(() => {
    if (!isOnline) {
      retryTimerRef.current = setInterval(async () => {
        const reachable = await probeConnection();
        if (reachable) {
          setIsOnline(true);
          if (wasOfflineRef.current) {
            setShowRestoredBadge(true);
            wasOfflineRef.current = false;
            setTimeout(() => setShowRestoredBadge(false), 2500);
          }
          queryClient.refetchQueries();
        }
      }, 4000);
    } else if (retryTimerRef.current) {
      clearInterval(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    return () => {
      if (retryTimerRef.current) {
        clearInterval(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [isOnline, probeConnection, queryClient]);

  // If back online notification
  if (showRestoredBadge) {
    return (
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none animate-[fadeSlideIn_0.3s_ease-out]">
        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-[#1db954] text-black text-xs font-bold shadow-2xl shadow-black/80">
          <Wifi size={15} className="stroke-[2.5]" />
          <span>Connection restored</span>
        </div>
      </div>
    );
  }

  // If offline
  if (!isOnline) {
    return (
      <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[9999] animate-[fadeSlideIn_0.3s_ease-out]">
        <div className="flex items-center gap-3.5 px-5 py-2.5 rounded-full bg-[#181818]/95 backdrop-blur-md border border-[#282828] text-white text-xs font-medium shadow-2xl shadow-black/90">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <WifiOff size={15} className="text-amber-400" />
            <span className="text-zinc-200">No internet connection • Reconnecting...</span>
          </div>
          <button
            onClick={handleManualRetry}
            disabled={isReconnecting}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw size={11} className={isReconnecting ? "animate-spin" : ""} />
            {isReconnecting ? "Checking..." : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  return null;
}
