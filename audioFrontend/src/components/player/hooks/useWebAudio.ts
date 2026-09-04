"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  DEFAULT_BANDS,
  EQUALIZER_PRESETS,
} from "@/lib/equalizer-presets";

let globalAudioCtx: AudioContext | null = null;

export function useWebAudio(
  audioElement: HTMLAudioElement | null,
  isPlaying: boolean
) {
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const fadeGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  const [crossfadeDuration, setCrossfadeDurationState] = useState<number>(() => {
    if (typeof window === "undefined") return 0.5;
    const saved = localStorage.getItem("audiomelody_crossfade_sec");
    return saved !== null ? parseFloat(saved) : 0.5;
  });

  const [isEqEnabled, setIsEqEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("audiomelody_eq_enabled");
    return saved !== null ? saved === "true" : true;
  });

  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    if (typeof window === "undefined") return "flat";
    return localStorage.getItem("audiomelody_eq_preset") || "flat";
  });

  const [gains, setGains] = useState<number[]>(() => {
    if (typeof window === "undefined") return [0, 0, 0, 0, 0];
    try {
      const saved = localStorage.getItem("audiomelody_eq_gains");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 5) return parsed;
      }
    } catch {}
    return [0, 0, 0, 0, 0];
  });

  // Setup Web Audio graph
  useEffect(() => {
    if (!audioElement || isInitializedRef.current) return;

    const setupAudio = () => {
      try {
        const AudioCtxClass =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;

        if (!AudioCtxClass) return;

        if (!globalAudioCtx) {
          globalAudioCtx = new AudioCtxClass();
        }

        const ctx = globalAudioCtx;

        // Create Analyser
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.8;
        analyserRef.current = analyser;

        // Create Fade/Crossfade Gain Node
        const fadeGain = ctx.createGain();
        fadeGain.gain.setValueAtTime(1, ctx.currentTime);
        fadeGainRef.current = fadeGain;

        // Create 5-band filter chain
        const filters = DEFAULT_BANDS.map((band, idx) => {
          const filter = ctx.createBiquadFilter();
          filter.type = band.type;
          filter.frequency.value = band.frequency;
          filter.gain.value = isEqEnabled ? (gains[idx] ?? 0) : 0;
          return filter;
        });

        filtersRef.current = filters;

        // Create Source from HTML5 Audio Element
        if (!sourceRef.current) {
          try {
            sourceRef.current = ctx.createMediaElementSource(audioElement);
          } catch {
            // Already connected
          }
        }

        if (sourceRef.current) {
          // Connect: Source -> Filter 0 -> Filter 1 -> ... -> Filter 4 -> FadeGain -> Analyser -> Destination
          let prevNode: AudioNode = sourceRef.current;
          filters.forEach((filter) => {
            prevNode.connect(filter);
            prevNode = filter;
          });

          prevNode.connect(fadeGain);
          fadeGain.connect(analyser);
          analyser.connect(ctx.destination);
          isInitializedRef.current = true;
        }
      } catch (err) {
        console.warn("[WebAudio] Failed to initialize AudioContext:", err);
      }
    };

    setupAudio();
  }, [audioElement]);

  // Resume AudioContext on play / user interaction
  useEffect(() => {
    if (isPlaying && globalAudioCtx && globalAudioCtx.state === "suspended") {
      globalAudioCtx.resume().catch((err) => {
        console.warn("[WebAudio] Resume failed:", err);
      });
    }
  }, [isPlaying]);

  // Apply gains when gains or EQ enabled status change
  useEffect(() => {
    filtersRef.current.forEach((filter, idx) => {
      const targetGain = isEqEnabled ? gains[idx] ?? 0 : 0;
      if (globalAudioCtx && filter.gain) {
        filter.gain.setTargetAtTime(targetGain, globalAudioCtx.currentTime, 0.05);
      }
    });

    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_eq_gains", JSON.stringify(gains));
      localStorage.setItem("audiomelody_eq_enabled", String(isEqEnabled));
      localStorage.setItem("audiomelody_eq_preset", selectedPreset);
    }
  }, [gains, isEqEnabled, selectedPreset]);

  const setBandGain = useCallback((bandIndex: number, gainValue: number) => {
    setGains((prev) => {
      const updated = [...prev];
      updated[bandIndex] = Math.max(-12, Math.min(12, gainValue));
      return updated;
    });
    setSelectedPreset("custom");
  }, []);

  const applyPreset = useCallback((presetId: string) => {
    const preset = EQUALIZER_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setGains(preset.gains);
      setSelectedPreset(preset.id);
    }
  }, []);

  const setCrossfadeDuration = useCallback((seconds: number) => {
    const sec = Math.max(0, Math.min(10, seconds));
    setCrossfadeDurationState(sec);
    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_crossfade_sec", sec.toString());
    }
  }, []);

  const fadeIn = useCallback(
    (durationSec = crossfadeDuration) => {
      if (!fadeGainRef.current || !globalAudioCtx || durationSec <= 0) {
        if (fadeGainRef.current && globalAudioCtx) {
          fadeGainRef.current.gain.setValueAtTime(1, globalAudioCtx.currentTime);
        }
        return;
      }
      const now = globalAudioCtx.currentTime;
      fadeGainRef.current.gain.cancelScheduledValues(now);
      fadeGainRef.current.gain.setValueAtTime(0.001, now);
      fadeGainRef.current.gain.exponentialRampToValueAtTime(1, now + durationSec);
    },
    [crossfadeDuration]
  );

  const fadeOut = useCallback(
    (durationSec = crossfadeDuration) => {
      if (!fadeGainRef.current || !globalAudioCtx || durationSec <= 0) {
        return;
      }
      const now = globalAudioCtx.currentTime;
      fadeGainRef.current.gain.cancelScheduledValues(now);
      fadeGainRef.current.gain.setValueAtTime(
        Math.max(0.001, fadeGainRef.current.gain.value),
        now
      );
      fadeGainRef.current.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
    },
    [crossfadeDuration]
  );

  const resetEq = useCallback(() => {
    applyPreset("flat");
  }, [applyPreset]);

  const toggleEq = useCallback(() => {
    setIsEqEnabled((prev) => !prev);
  }, []);

  return {
    analyser: analyserRef.current,
    audioContext: globalAudioCtx,
    isEqEnabled,
    gains,
    selectedPreset,
    crossfadeDuration,
    setCrossfadeDuration,
    fadeIn,
    fadeOut,
    setBandGain,
    applyPreset,
    resetEq,
    toggleEq,
  };
}
