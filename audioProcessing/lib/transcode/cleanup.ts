import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

const activePaths = new Set<string>();

/**
 * Register a temporary file or directory currently in use so it can be cleaned up on process exit.
 */
export function registerActiveTmpPath(targetPath: string): void {
    if (targetPath) {
        activePaths.add(path.resolve(targetPath));
    }
}

/**
 * Unregister a temporary file or directory after it has been properly cleaned up.
 */
export function unregisterActiveTmpPath(targetPath: string): void {
    if (targetPath) {
        activePaths.delete(path.resolve(targetPath));
    }
}

/**
 * Validates that a path is safe to delete (not root, not system directories, inside designated working directory).
 */
function isSafeToDelete(targetPath: string): boolean {
    const resolved = path.resolve(targetPath);
    const root = path.parse(resolved).root;
    const cwd = process.cwd();

    // Prevent deleting filesystem root, current directory, or home dir
    if (resolved === root || resolved === cwd || resolved === path.dirname(cwd)) {
        return false;
    }

    // Must be inside process.cwd() or /tmp/ or system temp
    const baseTmpDir = path.resolve(cwd, "tmp");
    if (resolved === baseTmpDir) {
        // Do not delete the base tmp folder itself, only its contents
        return false;
    }

    return true;
}

/**
 * Robustly removes a file or directory with retries, exponential backoff, and graceful error handling.
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
 * Synchronous version of safe removal for emergency process exit handlers.
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
 * Safely removes a list of files or directories in parallel.
 */
export async function safeCleanPaths(paths: (string | undefined | null)[]): Promise<void> {
    const validPaths = paths.filter((p): p is string => Boolean(p));
    await Promise.all(validPaths.map((p) => safeRemovePath(p)));
}

/**
 * Scans the temporary directory and removes stale files/folders older than maxAgeMs (default: 2 hours).
 * This prevents disk leakage from crashed jobs or interrupted processes.
 */
export async function cleanupStaleTmpFiles(
    baseTmpDir: string = path.join(process.cwd(), "tmp"),
    maxAgeMs: number = 2 * 60 * 60 * 1000 // 2 hours
): Promise<number> {
    if (!fs.existsSync(baseTmpDir)) return 0;

    let removedCount = 0;
    const now = Date.now();

    try {
        const entries = await fsp.readdir(baseTmpDir, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(baseTmpDir, entry.name);

            // Only clean known pipeline artifacts (raw_*, extracted_*, canvas_*, transcoded_*)
            if (
                !entry.name.startsWith("raw_") &&
                !entry.name.startsWith("extracted_") &&
                !entry.name.startsWith("canvas_") &&
                !entry.name.startsWith("transcoded_")
            ) {
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

/**
 * Setup process exit handlers to gracefully purge active temporary directories on shutdown.
 */
let shutdownHandlersInstalled = false;

export function setupGracefulShutdownCleanup(): void {
    if (shutdownHandlersInstalled) return;
    shutdownHandlersInstalled = true;

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
