export interface EqualizerBand {
  frequency: number;
  label: string;
  type: BiquadFilterType;
  gain: number; // in dB (-12 to +12)
}

export interface EqualizerPreset {
  id: string;
  name: string;
  gains: number[]; // 5 band gains [60Hz, 250Hz, 1kHz, 4kHz, 14kHz]
}

export const DEFAULT_BANDS: { frequency: number; label: string; type: BiquadFilterType }[] = [
  { frequency: 60, label: "60Hz", type: "lowshelf" },
  { frequency: 250, label: "250Hz", type: "peaking" },
  { frequency: 1000, label: "1kHz", type: "peaking" },
  { frequency: 4000, label: "4kHz", type: "peaking" },
  { frequency: 14000, label: "14kHz", type: "highshelf" },
];

export const EQUALIZER_PRESETS: EqualizerPreset[] = [
  {
    id: "flat",
    name: "Flat",
    gains: [0, 0, 0, 0, 0],
  },
  {
    id: "bass_boost",
    name: "Bass Boost",
    gains: [7, 5, 1, 0, -1],
  },
  {
    id: "electronic",
    name: "Electronic",
    gains: [5, 3, -1, 3, 5],
  },
  {
    id: "rock",
    name: "Rock",
    gains: [5, 3, -2, 4, 6],
  },
  {
    id: "pop",
    name: "Pop",
    gains: [-1, 2, 5, 3, -1],
  },
  {
    id: "vocal_boost",
    name: "Vocal Boost",
    gains: [-2, 0, 6, 4, 1],
  },
  {
    id: "jazz",
    name: "Jazz",
    gains: [4, 2, -1, 3, 4],
  },
  {
    id: "acoustic",
    name: "Acoustic",
    gains: [3, 2, 1, 3, 4],
  },
  {
    id: "classical",
    name: "Classical",
    gains: [4, 3, -1, 3, 4],
  },
];
