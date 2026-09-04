"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  DEFAULT_BANDS,
  EQUALIZER_PRESETS,
} from "@/lib/equalizer-presets";

let globalAudioCtx: AudioContext | null = null;

export type SpatialPreset = "off" | "concert" | "club" | "studio" | "cathedral";

// Helper to generate synthetic impulse responses for reverb without external audio files
function createSyntheticImpulse(
  ctx: AudioContext,
  duration: number,
  decay: number,
  reverse = false
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(sampleRate * duration));
  const impulse = ctx.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const n = reverse ? length - 1 - i : i;
    const factor = Math.pow(1 - n / length, decay);
    left[i] = (Math.random() * 2 - 1) * factor;
    right[i] = (Math.random() * 2 - 1) * factor;
  }
  return impulse;
}

export function useWebAudio(
  audioElement: HTMLAudioElement | null,
  isPlaying: boolean
) {
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const fadeGainRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // FX Nodes Refs
  const bassBoostFilterRef = useRef<BiquadFilterNode | null>(null);
  const pannerRef = useRef<StereoPannerNode | null>(null);
  const convolverRef = useRef<ConvolverNode | null>(null);
  const reverbDryGainRef = useRef<GainNode | null>(null);
  const reverbWetGainRef = useRef<GainNode | null>(null);
  const karaokeDryGainRef = useRef<GainNode | null>(null);
  const karaokeWetGainRef = useRef<GainNode | null>(null);
  const karaokeFilterRef = useRef<BiquadFilterNode | null>(null);

  // States
  const [crossfadeDuration, setCrossfadeDurationState] = useState<number>(() => {
    if (typeof window === "undefined") return 0.5;
    const saved = localStorage.getItem("audiomelody_crossfade_sec");
    return saved !== null ? parseFloat(saved) : 0.5;
  });

  const [crossfadeCurve, setCrossfadeCurveState] = useState<"constant_power" | "linear">(() => {
    if (typeof window === "undefined") return "constant_power";
    return (localStorage.getItem("audiomelody_crossfade_curve") as any) || "constant_power";
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

  // 1. Karaoke Mode State
  const [isKaraokeEnabled, setIsKaraokeEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("audiomelody_karaoke_enabled") === "true";
  });

  // 2. Bass Boost Level (0 to 100%)
  const [bassBoost, setBassBoostState] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("audiomelody_bass_boost");
    return saved !== null ? parseFloat(saved) : 0;
  });

  // 3. Spatial Audio / Reverb Preset
  const [spatialPreset, setSpatialPresetState] = useState<SpatialPreset>(() => {
    if (typeof window === "undefined") return "off";
    return (localStorage.getItem("audiomelody_spatial_preset") as SpatialPreset) || "off";
  });

  const [panPosition, setPanPositionState] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const saved = localStorage.getItem("audiomelody_pan_pos");
    return saved !== null ? parseFloat(saved) : 0;
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

        // Create Fade/Crossfade Master Gain Node
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

        // Bass Maximizer Filter (Low Shelf at 80Hz)
        const bassBoostFilter = ctx.createBiquadFilter();
        bassBoostFilter.type = "lowshelf";
        bassBoostFilter.frequency.value = 80;
        bassBoostFilter.gain.value = (bassBoost / 100) * 12; // up to +12dB
        bassBoostFilterRef.current = bassBoostFilter;

        // Karaoke Mid-Side / Band-Pass Vocal Attenuation Node
        const karaokeDryGain = ctx.createGain();
        const karaokeWetGain = ctx.createGain();
        const karaokeFilter = ctx.createBiquadFilter();
        karaokeFilter.type = "peaking";
        karaokeFilter.frequency.value = 1000;
        karaokeFilter.Q.value = 1.2;
        karaokeFilter.gain.value = isKaraokeEnabled ? -18 : 0;
        karaokeDryGain.gain.value = isKaraokeEnabled ? 0.2 : 1;
        karaokeWetGain.gain.value = isKaraokeEnabled ? 0.8 : 0;
        karaokeDryGainRef.current = karaokeDryGain;
        karaokeWetGainRef.current = karaokeWetGain;
        karaokeFilterRef.current = karaokeFilter;

        // Spatial Panner Node
        const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        if (panner) {
          panner.pan.value = panPosition;
          pannerRef.current = panner;
        }

        // Reverb Convolver & Dry/Wet Gain Nodes
        const convolver = ctx.createConvolver();
        const reverbDryGain = ctx.createGain();
        const reverbWetGain = ctx.createGain();
        convolverRef.current = convolver;
        reverbDryGainRef.current = reverbDryGain;
        reverbWetGainRef.current = reverbWetGain;

        // Create Source from HTML5 Audio Element
        if (!sourceRef.current) {
          try {
            sourceRef.current = ctx.createMediaElementSource(audioElement);
          } catch {
            // Already connected
          }
        }

        if (sourceRef.current) {
          // Connect: Source -> 5 EQ Filters -> Bass Boost -> Karaoke Filter -> Panner
          let prevNode: AudioNode = sourceRef.current;
          filters.forEach((filter) => {
            prevNode.connect(filter);
            prevNode = filter;
          });

          prevNode.connect(bassBoostFilter);
          bassBoostFilter.connect(karaokeFilter);

          // Panner output
          const pannerInput: AudioNode = karaokeFilter;
          let pannerOutput: AudioNode = pannerInput;
          if (panner) {
            pannerInput.connect(panner);
            pannerOutput = panner;
          }

          // Reverb Dry/Wet Mixing
          pannerOutput.connect(reverbDryGain);
          pannerOutput.connect(convolver);
          convolver.connect(reverbWetGain);

          const fxMerge = ctx.createGain();
          reverbDryGain.connect(fxMerge);
          reverbWetGain.connect(fxMerge);

          fxMerge.connect(fadeGain);
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

  // Apply EQ gains
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

  // Apply Bass Boost
  useEffect(() => {
    if (bassBoostFilterRef.current && globalAudioCtx) {
      const gainVal = (bassBoost / 100) * 12; // up to +12dB
      bassBoostFilterRef.current.gain.setTargetAtTime(
        gainVal,
        globalAudioCtx.currentTime,
        0.05
      );
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_bass_boost", bassBoost.toString());
    }
  }, [bassBoost]);

  // Apply Karaoke Mode
  useEffect(() => {
    if (karaokeFilterRef.current && globalAudioCtx) {
      const targetGain = isKaraokeEnabled ? -22 : 0;
      karaokeFilterRef.current.gain.setTargetAtTime(
        targetGain,
        globalAudioCtx.currentTime,
        0.05
      );
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_karaoke_enabled", String(isKaraokeEnabled));
    }
  }, [isKaraokeEnabled]);

  // Apply Pan Position
  useEffect(() => {
    if (pannerRef.current && globalAudioCtx) {
      pannerRef.current.pan.setTargetAtTime(panPosition, globalAudioCtx.currentTime, 0.05);
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_pan_pos", panPosition.toString());
    }
  }, [panPosition]);

  // Apply Spatial / Reverb Preset
  useEffect(() => {
    if (!globalAudioCtx || !convolverRef.current || !reverbDryGainRef.current || !reverbWetGainRef.current) return;
    const ctx = globalAudioCtx;
    const dry = reverbDryGainRef.current;
    const wet = reverbWetGainRef.current;

    switch (spatialPreset) {
      case "concert":
        convolverRef.current.buffer = createSyntheticImpulse(ctx, 2.5, 2.0);
        dry.gain.setTargetAtTime(0.85, ctx.currentTime, 0.05);
        wet.gain.setTargetAtTime(0.35, ctx.currentTime, 0.05);
        break;
      case "club":
        convolverRef.current.buffer = createSyntheticImpulse(ctx, 1.2, 3.0);
        dry.gain.setTargetAtTime(0.9, ctx.currentTime, 0.05);
        wet.gain.setTargetAtTime(0.28, ctx.currentTime, 0.05);
        break;
      case "studio":
        convolverRef.current.buffer = createSyntheticImpulse(ctx, 0.6, 4.5);
        dry.gain.setTargetAtTime(0.95, ctx.currentTime, 0.05);
        wet.gain.setTargetAtTime(0.15, ctx.currentTime, 0.05);
        break;
      case "cathedral":
        convolverRef.current.buffer = createSyntheticImpulse(ctx, 4.0, 1.5);
        dry.gain.setTargetAtTime(0.75, ctx.currentTime, 0.05);
        wet.gain.setTargetAtTime(0.45, ctx.currentTime, 0.05);
        break;
      case "off":
      default:
        dry.gain.setTargetAtTime(1.0, ctx.currentTime, 0.05);
        wet.gain.setTargetAtTime(0.0, ctx.currentTime, 0.05);
        break;
    }

    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_spatial_preset", spatialPreset);
    }
  }, [spatialPreset]);

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
    const sec = Math.max(0, Math.min(12, seconds));
    setCrossfadeDurationState(sec);
    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_crossfade_sec", sec.toString());
    }
  }, []);

  const setCrossfadeCurve = useCallback((curve: "constant_power" | "linear") => {
    setCrossfadeCurveState(curve);
    if (typeof window !== "undefined") {
      localStorage.setItem("audiomelody_crossfade_curve", curve);
    }
  }, []);

  const setBassBoost = useCallback((level: number) => {
    setBassBoostState(Math.max(0, Math.min(100, level)));
  }, []);

  const setSpatialPreset = useCallback((preset: SpatialPreset) => {
    setSpatialPresetState(preset);
  }, []);

  const setPanPosition = useCallback((pos: number) => {
    setPanPositionState(Math.max(-1, Math.min(1, pos)));
  }, []);

  const toggleKaraoke = useCallback(() => {
    setIsKaraokeEnabled((prev) => !prev);
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
      if (crossfadeCurve === "constant_power") {
        fadeGainRef.current.gain.exponentialRampToValueAtTime(1, now + durationSec);
      } else {
        fadeGainRef.current.gain.linearRampToValueAtTime(1, now + durationSec);
      }
    },
    [crossfadeDuration, crossfadeCurve]
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
      if (crossfadeCurve === "constant_power") {
        fadeGainRef.current.gain.exponentialRampToValueAtTime(0.001, now + durationSec);
      } else {
        fadeGainRef.current.gain.linearRampToValueAtTime(0.001, now + durationSec);
      }
    },
    [crossfadeDuration, crossfadeCurve]
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
    crossfadeCurve,
    bassBoost,
    spatialPreset,
    panPosition,
    isKaraokeEnabled,
    setCrossfadeDuration,
    setCrossfadeCurve,
    setBassBoost,
    setSpatialPreset,
    setPanPosition,
    toggleKaraoke,
    fadeIn,
    fadeOut,
    setBandGain,
    applyPreset,
    resetEq,
    toggleEq,
  };
}
