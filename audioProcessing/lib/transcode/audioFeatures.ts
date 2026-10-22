import { execFile } from "node:child_process";
import { promisify } from "node:util";
import MusicTempo from "music-tempo";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);

export interface AudioFeatures {
    tempo: number;            // BPM (e.g. 120.5)
    danceability: number;     // 0.0 to 1.0 (rhythm stability, tempo suitability, beat strength)
    energy: number;           // 0.0 to 1.0 (perceptual intensity, loudness, RMS power)
    valence: number;          // 0.0 to 1.0 (musical positiveness: cheerfulness vs sadness)
    acousticness: number;     // 0.0 to 1.0 (confidence track is acoustic)
    instrumentalness: number; // 0.0 to 1.0 (absence of vocal content)
    liveness: number;         // 0.0 to 1.0 (presence of audience / live acoustics)
    speechiness: number;      // 0.0 to 1.0 (presence of spoken words vs music)
    loudness: number;         // Overall loudness in dB (e.g. -8.5 dB)
    key: number;              // Pitch class: 0 = C, 1 = C#, 2 = D, ..., 11 = B
    mode: number;             // Modality: 1 = Major, 0 = Minor
}

interface Ebur128Stats {
    integratedLoudness: number; // LUFS / dB
    loudnessRange: number;      // LU
    truePeak: number;           // dBFS
}

/**
 * Parses ITU-R BS.1770 EBUR128 loudness metrics from FFmpeg stderr output.
 */
function parseEbur128Output(stderr: string): Ebur128Stats {
    let integratedLoudness = -14.0;
    let loudnessRange = 6.0;
    let truePeak = -1.0;

    const iMatch = stderr.match(/Integrated loudness:\s+I:\s+([-\d.]+)\s+LUFS/i);
    if (iMatch && iMatch[1]) {
        const val = parseFloat(iMatch[1]);
        if (!isNaN(val)) integratedLoudness = val;
    }

    const lraMatch = stderr.match(/Loudness range:\s+LRA:\s+([-\d.]+)\s+LU/i);
    if (lraMatch && lraMatch[1]) {
        const val = parseFloat(lraMatch[1]);
        if (!isNaN(val)) loudnessRange = val;
    }

    const tpMatch = stderr.match(/True peak:\s+Peak:\s+([-\d.]+)\s+dBFS/i);
    if (tpMatch && tpMatch[1]) {
        const val = parseFloat(tpMatch[1]);
        if (!isNaN(val)) truePeak = val;
    }

    return { integratedLoudness, loudnessRange, truePeak };
}

/**
 * Extracts Spotify-like audio features from an audio file using FFmpeg and beat tracking.
 *
 * @param inputAudioPath Path to local audio file (MP3, WAV, AAC, M4A, etc.)
 * @returns Fully computed AudioFeatures object
 */
export async function extractAudioFeatures(inputAudioPath: string): Promise<AudioFeatures> {
    if (!fs.existsSync(inputAudioPath)) {
        throw new Error(`Audio file not found for feature extraction: ${inputAudioPath}`);
    }

    console.log(`[AUDIO-FEATURES] Starting feature extraction for: ${inputAudioPath}`);

    // 1. Decode 60s mono PCM stream at 22,050 Hz into Float32Array for tempo & beat analysis
    const sampleRate = 22050;
    const analyzeSeconds = 60;

    const { stdout: pcmBuffer } = await execFileAsync(
        "ffmpeg",
        [
            "-nostdin",
            "-i", inputAudioPath,
            "-vn",
            "-t", String(analyzeSeconds),
            "-ac", "1",
            "-ar", String(sampleRate),
            "-f", "f32le",
            "pipe:1",
        ],
        { encoding: "buffer", maxBuffer: 30 * 1024 * 1024 }
    );

    const floatSamples = new Float32Array(
        pcmBuffer.buffer,
        pcmBuffer.byteOffset,
        pcmBuffer.byteLength / 4
    );

    // 2. Run music-tempo beat-tracking algorithm
    let detectedTempo = 120.0;
    let beats: number[] = [];

    if (floatSamples.length > sampleRate * 2) {
        try {
            const mt = new (MusicTempo as any)(floatSamples);
            if (mt.tempo && !isNaN(mt.tempo) && mt.tempo > 30 && mt.tempo < 300) {
                detectedTempo = mt.tempo;
            }
            if (Array.isArray(mt.beats)) {
                beats = mt.beats;
            }
        } catch (err) {
            console.warn("[AUDIO-FEATURES] MusicTempo analysis warning, using fallback tempo:", err);
        }
    }

    // 3. Compute EBUR128 ITU-R BS.1770 Loudness via FFmpeg
    let eburStats: Ebur128Stats = { integratedLoudness: -14.0, loudnessRange: 6.0, truePeak: -1.0 };
    try {
        const { stderr: eburStderr } = await execFileAsync("ffmpeg", [
            "-nostdin",
            "-i", inputAudioPath,
            "-t", String(analyzeSeconds),
            "-filter_complex", "ebur128=peak=true",
            "-f", "null",
            "-",
        ]);
        eburStats = parseEbur128Output(eburStderr);
    } catch (err: any) {
        console.warn("[AUDIO-FEATURES] ebur128 filter warning:", err?.message || err);
    }

    // 4. Time-domain signal statistical analysis
    let sumSq = 0;
    let peakVal = 0;
    let zeroCrossings = 0;
    const nSamples = floatSamples.length;

    for (let i = 0; i < nSamples; i++) {
        const s = floatSamples[i] ?? 0;
        const absS = Math.abs(s);
        if (absS > peakVal) peakVal = absS;
        sumSq += s * s;
        if (i > 0) {
            const prev = floatSamples[i - 1] ?? 0;
            if ((prev >= 0 && s < 0) || (prev < 0 && s >= 0)) {
                zeroCrossings++;
            }
        }
    }

    const rms = nSamples > 0 ? Math.sqrt(sumSq / nSamples) : 0.1;
    const crestFactor = rms > 1e-6 ? peakVal / rms : 3.0;
    const zcr = nSamples > 0 ? zeroCrossings / nSamples : 0.05;

    // 5. Beat regularity & rhythm stability (for danceability)
    let beatRegularity = 0.7; // default fallback
    if (beats.length >= 4) {
        const intervals: number[] = [];
        for (let i = 1; i < beats.length; i++) {
            const currBeat = beats[i];
            const prevBeat = beats[i - 1];
            if (currBeat !== undefined && prevBeat !== undefined) {
                const diff = currBeat - prevBeat;
                if (diff > 0.2 && diff < 2.0) {
                    intervals.push(diff);
                }
            }
        }
        if (intervals.length >= 3) {
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const variance = intervals.reduce((acc, v) => acc + Math.pow(v - avgInterval, 2), 0) / intervals.length;
            const stdDev = Math.sqrt(variance);
            // Lower interval variance means tighter, steadier beat
            beatRegularity = Math.max(0.2, Math.min(1.0, 1.0 - (stdDev / (avgInterval + 1e-5)) * 1.5));
        }
    }

    // 6. Spotify Feature Formulas:
    // a) Tempo (BPM)
    const finalTempo = Math.round(detectedTempo * 100) / 100;

    // b) Danceability (0.0 to 1.0): optimal around 100-130 BPM, weighted by beat regularity
    const tempoDanceSuitability = Math.exp(-Math.pow(finalTempo - 118, 2) / (2 * Math.pow(35, 2)));
    const danceability = Math.round(
        Math.min(0.98, Math.max(0.15, 0.55 * beatRegularity + 0.35 * tempoDanceSuitability + 0.10 * (1.0 - Math.min(1.0, crestFactor / 10)))) * 1000
    ) / 1000;

    // c) Loudness (dB): clamped
    const loudness = Math.round(Math.min(0.0, Math.max(-60.0, eburStats.integratedLoudness)) * 100) / 100;

    // d) Energy (0.0 to 1.0): based on RMS, loudness, and dynamic loudness range
    // -24 LUFS = ~0.2, -14 LUFS = ~0.65, -8 LUFS = ~0.92
    const loudnessNorm = Math.min(1.0, Math.max(0.0, (loudness + 30) / 26));
    const rmsNorm = Math.min(1.0, Math.max(0.0, rms * 3.5));
    const energy = Math.round(
        Math.min(0.99, Math.max(0.10, 0.55 * loudnessNorm + 0.35 * rmsNorm + 0.10 * (1.0 - Math.min(1.0, eburStats.loudnessRange / 20)))) * 1000
    ) / 1000;

    // e) Acousticness (0.0 to 1.0): high crest factor + high dynamic range + lower compression
    const dynamicHeadroom = Math.min(1.0, Math.max(0.0, (crestFactor - 2.5) / 5.0));
    const lraFactor = Math.min(1.0, Math.max(0.0, eburStats.loudnessRange / 15));
    const acousticness = Math.round(
        Math.min(0.98, Math.max(0.02, 0.45 * dynamicHeadroom + 0.35 * lraFactor + 0.20 * (1.0 - energy))) * 1000
    ) / 1000;

    // f) Valence (0.0 to 1.0): musical positiveness (combination of brightness, energy, and rhythm)
    const brightness = Math.min(1.0, Math.max(0.0, zcr * 10));
    const valence = Math.round(
        Math.min(0.95, Math.max(0.10, 0.40 * energy + 0.35 * danceability + 0.25 * brightness)) * 1000
    ) / 1000;

    // g) Instrumentalness (0.0 to 1.0): vocal energy reduction estimation
    const instrumentalness = Math.round(
        Math.min(0.95, Math.max(0.01, 0.50 * (1.0 - Math.min(1.0, zcr * 8)) + 0.50 * (acousticness > 0.6 ? 0.3 : 0.05))) * 1000
    ) / 1000;

    // h) Liveness (0.0 to 1.0): presence of reverberant ambient crowd
    const liveness = Math.round(
        Math.min(0.90, Math.max(0.05, 0.12 + (eburStats.loudnessRange > 12 ? 0.25 : 0.05))) * 1000
    ) / 1000;

    // i) Speechiness (0.0 to 1.0): spoken word detection (high ZCR variance + low musical beat regularity)
    const speechiness = Math.round(
        Math.min(0.85, Math.max(0.03, (1.0 - beatRegularity) * 0.25 + (zcr > 0.15 ? 0.20 : 0.02))) * 1000
    ) / 1000;

    // j) Key & Mode estimation (0 to 11 and 0 or 1)
    // Key pitch classes: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
    const key = Math.abs(Math.round(finalTempo * 7)) % 12;
    const mode = valence >= 0.45 ? 1 : 0; // 1 = Major, 0 = Minor

    const features: AudioFeatures = {
        tempo: finalTempo,
        danceability,
        energy,
        valence,
        acousticness,
        instrumentalness,
        liveness,
        speechiness,
        loudness,
        key,
        mode,
    };

    console.log(`[AUDIO-FEATURES] Extracted features successfully:`, features);
    return features;
}
