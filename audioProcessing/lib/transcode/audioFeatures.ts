/**
 * Audio features nikalna (Spotify jaise): tempo, danceability, energy, valence, wagairah.
 *
 * Kaise: FFmpeg se pehle 60 second ka mono audio (22,050 Hz) numbers me nikaalte hain, music-tempo
 * library se beats dhoondte hain, FFmpeg ke ebur128 filter se loudness naapte hain, aur kuch simple
 * signal statistics (RMS, peak, zero crossings) se andaze wale formulas lagate hain.
 * Ye asli ML model nahi hai - sirf andaza (heuristic) hai, recommendation ke liye kaafi.
 *
 * Kaun call karta hai: functions/extractAudioFeatures.ts. Result admin API ke jobs table me jaata hai.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import MusicTempo from "music-tempo";
import * as fs from "node:fs";

const execFileAsync = promisify(execFile);

/** Ek gaane ke saare features (0.0-1.0 wale "kitna" batate hain). */
export interface AudioFeatures {
    tempo: number;            // BPM - ek minute me kitni beats (jaise 120.5)
    danceability: number;     // 0.0-1.0: naachne layak (beat kitni steady, tempo kitna sahi)
    energy: number;           // 0.0-1.0: kitna tez / josh wala (loudness, RMS power)
    valence: number;          // 0.0-1.0: khushi (zyada) vs udaasi (kam)
    acousticness: number;     // 0.0-1.0: kitna acoustic (bina electronic) lagta hai
    instrumentalness: number; // 0.0-1.0: awaaz (vocals) kitni kam hai
    liveness: number;         // 0.0-1.0: live performance / audience jaisa lagta hai
    speechiness: number;      // 0.0-1.0: bolne wale shabd kitne (gaane ke mukable)
    loudness: number;         // Poori awaaz dB me (jaise -8.5 dB; 0 ke paas = zyada tez)
    key: number;              // Sur: 0 = C, 1 = C#, 2 = D, ..., 11 = B
    mode: number;             // 1 = Major (khushnuma), 0 = Minor (gambhir)
}

/** FFmpeg ebur128 filter se mili loudness values. */
interface Ebur128Stats {
    integratedLoudness: number; // LUFS / dB
    loudnessRange: number;      // LU
    truePeak: number;           // dBFS
}

/**
 * FFmpeg ke stderr se EBU R128 (ITU-R BS.1770 standard) loudness values padho (regex se).
 * Koi value na mile to normal default: -14 LUFS, LRA 6, peak -1 dBFS.
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

/** Value ko min aur max ke beech rakho. */
function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

/** 3 decimal tak round (jaise 0.12345 -> 0.123). */
function round3(value: number): number {
    return Math.round(value * 1000) / 1000;
}

/**
 * Audio file se saare features nikalo (upar file header me tareeka).
 *
 * @param inputAudioPath Local audio file ka path (MP3, WAV, AAC, M4A, wagairah)
 * @returns Poora AudioFeatures object
 * File na ho to error. Beat / loudness analysis fail ho to default values se kaam chala lete hain.
 */
export async function extractAudioFeatures(inputAudioPath: string): Promise<AudioFeatures> {
    if (!fs.existsSync(inputAudioPath)) {
        throw new Error(`Audio file not found for feature extraction: ${inputAudioPath}`);
    }

    console.log(`[AUDIO-FEATURES] Starting feature extraction for: ${inputAudioPath}`);

    // 1. Pehle 60 second ko mono, 22,050 Hz ke float numbers (PCM) me decode karo - tempo / beat ke liye.
    //    Poora gaana nahi: 60 second kaafi hai aur RAM / time bachta hai.
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

    // 2. music-tempo library se beats aur tempo dhoondo (2 second se kam audio ho to default 120 BPM)
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

    // 3. FFmpeg ke ebur128 filter se loudness (fail ho to defaults)
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

    // 4. Signal ki simple statistics: RMS (average taakat), peak (sabse ooncha), zero crossings
    //    (signal kitni baar 0 paar karta hai - zyada = tez / "hiss" wali awaaz, jaise bolna ya cymbals)
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

    // 5. Beat kitni regular hai (danceability ke liye): do beats ke beech ka gap kitna badalta hai
    let beatRegularity = 0.7; // kaafi beats na milein to ye default
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
            // Gap kam badle (kam variance) = steady beat = regularity zyada
            beatRegularity = Math.max(0.2, Math.min(1.0, 1.0 - (stdDev / (avgInterval + 1e-5)) * 1.5));
        }
    }

    // 6. Features ke formulas (andaze wale weights):
    // a) Tempo (BPM), 2 decimal tak
    const finalTempo = Math.round(detectedTempo * 100) / 100;

    // b) Danceability: ~118 BPM sabse achha (bell curve), saath me beat regularity ka sabse zyada weight
    const tempoDanceSuitability = Math.exp(-Math.pow(finalTempo - 118, 2) / (2 * Math.pow(35, 2)));
    const danceability = round3(
        clamp(0.55 * beatRegularity + 0.35 * tempoDanceSuitability + 0.10 * (1.0 - Math.min(1.0, crestFactor / 10)), 0.15, 0.98)
    );

    // c) Loudness (dB): -60 se 0 ke beech
    const loudness = Math.round(Math.min(0.0, Math.max(-60.0, eburStats.integratedLoudness)) * 100) / 100;

    // d) Energy: loudness + RMS + (kam dynamic range = zyada energy)
    // -24 LUFS = ~0.2, -14 LUFS = ~0.65, -8 LUFS = ~0.92
    const loudnessNorm = clamp((loudness + 30) / 26, 0.0, 1.0);
    const rmsNorm = clamp(rms * 3.5, 0.0, 1.0);
    const energy = round3(
        clamp(0.55 * loudnessNorm + 0.35 * rmsNorm + 0.10 * (1.0 - Math.min(1.0, eburStats.loudnessRange / 20)), 0.10, 0.99)
    );

    // e) Acousticness: peak aur average me bada farak (crest factor) + zyada dynamic range + kam energy.
    //    Electronic / heavily compressed gaano me ye farak kam hota hai.
    const dynamicHeadroom = clamp((crestFactor - 2.5) / 5.0, 0.0, 1.0);
    const lraFactor = clamp(eburStats.loudnessRange / 15, 0.0, 1.0);
    const acousticness = round3(
        clamp(0.45 * dynamicHeadroom + 0.35 * lraFactor + 0.20 * (1.0 - energy), 0.02, 0.98)
    );

    // f) Valence (khushi): energy + danceability + "brightness" (zero crossing rate se)
    const brightness = clamp(zcr * 10, 0.0, 1.0);
    const valence = round3(
        clamp(0.40 * energy + 0.35 * danceability + 0.25 * brightness, 0.10, 0.95)
    );

    // g) Instrumentalness: kam zero crossings (kam vocals ka andaza) + acoustic ho to thoda zyada
    const instrumentalness = round3(
        clamp(0.50 * (1.0 - Math.min(1.0, zcr * 8)) + 0.50 * (acousticness > 0.6 ? 0.3 : 0.05), 0.01, 0.95)
    );

    // h) Liveness: loudness range bahut zyada (> 12 LU) ho to live / audience wala maan lo
    const liveness = round3(
        clamp(0.12 + (eburStats.loudnessRange > 12 ? 0.25 : 0.05), 0.05, 0.90)
    );

    // i) Speechiness: beat irregular + zero crossings zyada (> 0.15) = bolne jaisa
    const speechiness = round3(
        clamp((1.0 - beatRegularity) * 0.25 + (zcr > 0.15 ? 0.20 : 0.02), 0.03, 0.85)
    );

    // j) Key (0-11) aur mode (0/1). Dhyan do: ye asli sur nahi naapta - tempo se ek pakka (deterministic)
    //    number banata hai, aur mode valence se. Sur: C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
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
