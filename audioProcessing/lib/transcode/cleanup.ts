/**
 * Local disk ki safai: transcoding ke temp files / folders (tmp/ ke andar) hatana.
 *
 * - Chal rahe jobs ke paths yaad rakhte hain, taaki process band ho (SIGINT / SIGTERM) to unhe bhi hata sakein.
 * - Delete se pehle check: root, current folder ya tmp/ khud kabhi delete na ho.
 * - Crash hue jobs ki 2 ghante se purani files bhi saaf karte hain, warna disk bhar jaati.
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

// Abhi use ho rahe temp paths (poore / resolved path)
const activePaths = new Set<string>();

// Sirf inhi naamon se shuru hone wali cheezein pipeline ki hain - baaki ko stale cleanup kabhi nahi chhoota
const PIPELINE_ARTIFACT_PREFIXES = ["raw_", "extracted_", "canvas_", "transcoded_"];
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Ek temp file / folder ko "abhi use me" list me daalo, taaki process band hote waqt use bhi hata sakein.
 */
export function registerActiveTmpPath(targetPath: string): void {
    if (targetPath) {
        activePaths.add(path.resolve(targetPath));
    }
}

/**
 * Temp path ko list se hatao (jab wo saaf ho chuka ho).
 */
export function unregisterActiveTmpPath(targetPath: string): void {
    if (targetPath) {
        activePaths.delete(path.resolve(targetPath));
    }
}

/**
 * Kya ye path delete karna safe hai? Filesystem root, current folder, uska parent, aur tmp/ folder khud = NAHI.
 * (tmp/ ke andar ki cheezein delete ho sakti hain, tmp/ khud nahi.)
 */
function isSafeToDelete(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    const root = path.parse(resolved).root;
    const cwd = process.cwd();

    // Root, current folder ya uska parent kabhi delete nahi
    if (resolved === root || resolved === cwd || resolved === path.dirname(cwd)) {
        return false;
    }

    const baseTmpDir = path.resolve(cwd, "tmp");
    if (resolved === baseTmpDir) {
        // tmp/ folder khud nahi hatana - sirf uske andar ki cheezein
        return false;
    }

    return true;
}

/**
 * File ya folder hatao, retries ke saath (har baar thoda zyada ruk ke: 250ms, 500ms, 750ms...).
 * Output: hat gaya ya pehle se nahi tha = true; unsafe path ya saare retries fail = false. Kabhi error nahi phenkta.
 */
export async function safeRemovePath(
    targetPath: string | undefined | null,
    options: { maxRetries?: number; retryDelayMs?: number } = {}
): Promise<boolean> {
    if (!targetPath) return true;

    const resolved = path.resolve(targetPath);
    if (!isSafeToDelete(resolved)) {
        console.warn(`[CLEANUP] Blocked unsafe deletion attempt for: ${resolved}`);
        return false;
    }

    if (!fs.existsSync(resolved)) {
        unregisterActiveTmpPath(resolved);
        return true;
    }

    const maxRetries = options.maxRetries ?? 4;
    const retryDelayMs = options.retryDelayMs ?? 250;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            await fsp.rm(resolved, {
                recursive: true,
                force: true,
                maxRetries: 2,
                retryDelay: 100,
            });

            unregisterActiveTmpPath(resolved);
            return true;
        } catch (err: any) {
            if (err.code === "ENOENT") {
                unregisterActiveTmpPath(resolved);
                return true;
            }

            console.warn(
                `[CLEANUP] Attempt ${attempt}/${maxRetries} failed to remove ${resolved} (${err.code || err.message}).`
            );

            if (attempt < maxRetries) {
                await new Promise((r) => setTimeout(r, retryDelayMs * attempt));
            } else {
                console.error(`[CLEANUP] Final failure removing ${resolved}: ${err.message || err}`);
                return false;
            }
        }
    }

    return false;
}

/**
 * safeRemovePath ka synchronous (bina await) version - process exit handlers ke liye, jahan async kaam
 * poora hone ka intezaar nahi hota.
 */
export function safeRemovePathSync(targetPath: string | undefined | null): boolean {
    if (!targetPath) return true;

    const resolved = path.resolve(targetPath);
    if (!isSafeToDelete(resolved)) return false;

    if (!fs.existsSync(resolved)) {
        unregisterActiveTmpPath(resolved);
        return true;
    }

    try {
        fs.rmSync(resolved, { recursive: true, force: true });
        unregisterActiveTmpPath(resolved);
        return true;
    } catch (err: any) {
        if (err.code !== "ENOENT") {
            console.error(`[CLEANUP-SYNC] Error removing ${resolved}: ${err.message || err}`);
        }
        return false;
    }
}

/**
 * Kai paths ek saath (parallel) hatao; null / undefined chhod do.
 */
export async function safeCleanPaths(paths: (string | undefined | null)[]): Promise<void> {
    const validPaths = paths.filter((p): p is string => Boolean(p));
    await Promise.all(validPaths.map((p) => safeRemovePath(p)));
}

/**
 * tmp/ me maxAgeMs (default 2 ghante) se purani pipeline files / folders hatao.
 * Crash hue ya beech me ruke jobs ka kachra isi se saaf hota hai. Output: kitne hataye.
 */
export async function cleanupStaleTmpFiles(
    baseTmpDir: string = path.join(process.cwd(), "tmp"),
    maxAgeMs: number = TWO_HOURS_MS
): Promise<number> {
    if (!fs.existsSync(baseTmpDir)) return 0;

    let removedCount = 0;
    const now = Date.now();

    try {
        const entries = await fsp.readdir(baseTmpDir, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(baseTmpDir, entry.name);

            // Sirf pipeline ki jaani-pehchani cheezein (raw_*, extracted_*, canvas_*, transcoded_*)
            const isPipelineArtifact = PIPELINE_ARTIFACT_PREFIXES.some((prefix) => entry.name.startsWith(prefix));
            if (!isPipelineArtifact) {
                continue;
            }

            try {
                const stats = await fsp.stat(entryPath);
                const ageMs = now - stats.mtimeMs;

                if (ageMs > maxAgeMs) {
                    console.log(`[CLEANUP] Removing stale artifact (${Math.round(ageMs / 60000)}m old): ${entry.name}`);
                    const success = await safeRemovePath(entryPath);
                    if (success) removedCount++;
                }
            } catch (statErr: any) {
                if (statErr.code !== "ENOENT") {
                    console.warn(`[CLEANUP] Error checking ${entryPath}: ${statErr.message}`);
                }
            }
        }
    } catch (err: any) {
        console.error(`[CLEANUP] Error reading tmp dir for stale file cleanup: ${err.message}`);
    }

    return removedCount;
}

let shutdownHandlersInstalled = false;

/**
 * Process band hote waqt (Ctrl+C / SIGINT, docker stop / SIGTERM, ya normal exit) chal rahe jobs ke
 * temp paths hata do. Do baar call karne par bhi handlers ek hi baar lagte hain.
 */
export function setupGracefulShutdownCleanup(): void {
    if (shutdownHandlersInstalled) return;
    shutdownHandlersInstalled = true;

    /** Saare active temp paths sync tareeke se hatao. */
    const cleanupActiveSync = () => {
        if (activePaths.size > 0) {
            console.log(`[CLEANUP] Gracefully purging ${activePaths.size} active temporary paths on exit...`);
            for (const p of activePaths) {
                safeRemovePathSync(p);
            }
        }
    };

    process.once("SIGINT", () => {
        cleanupActiveSync();
        process.exit(0);
    });

    process.once("SIGTERM", () => {
        cleanupActiveSync();
        process.exit(0);
    });

    process.once("beforeExit", () => {
        cleanupActiveSync();
    });
}

/**
 * tmp/ me jinke naam me jobId ya songId hai, wo sab abhi hatao - taaki aadhe bane FFmpeg chunks ya
 * download ki hui raw files disk pe na padi rahein. Output: kitne hataye. Error = log, phenkta nahi.
 */
export async function purgeLocalJobArtifacts(
    jobId: string,
    songId?: string,
    baseTmpDir: string = path.join(process.cwd(), "tmp")
): Promise<number> {
    if (!fs.existsSync(baseTmpDir)) return 0;
    let removedCount = 0;

    try {
        const entries = await fsp.readdir(baseTmpDir, { withFileTypes: true });
        for (const entry of entries) {
            const matchesJob = jobId && entry.name.includes(jobId);
            const matchesSong = songId && entry.name.includes(songId);

            if (matchesJob || matchesSong) {
                const fullPath = path.join(baseTmpDir, entry.name);
                console.log(`[CLEANUP] Purging local job artifact from disk: ${entry.name}`);
                const ok = await safeRemovePath(fullPath);
                if (ok) removedCount++;
            }
        }
    } catch (err: any) {
        console.error(`[CLEANUP] Error purging local job artifacts for job ${jobId}:`, err.message || err);
    }

    return removedCount;
}
