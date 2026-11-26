/**
 * Audio aur video transcoders dono ke kaam ke chhote helpers (pehle dono files me copy-paste the).
 */
import * as path from "node:path";
import * as fs from "node:fs";

/**
 * Shaka "live" (dynamic) DASH file banata hai; hamare gaane / videos VOD (poore, recorded) hain.
 * Isliye type="static" karo, live wale attributes hatao, aur mediaPresentationDuration jodo
 * taaki player ko poori lambai pata ho (seek bar sahi bane).
 * Output: patch kiya to true; file hi nahi mili to false (kuch nahi karta).
 */
export function patchMpdForVod(mpdPath: string): boolean {
    if (!fs.existsSync(mpdPath)) return false;
    let content = fs.readFileSync(mpdPath, "utf-8");

    content = content.replace(/\btype="dynamic"/, 'type="static"');
    content = content.replace(/\s*minimumUpdatePeriod="[^"]*"/, "");
    content = content.replace(/\s*availabilityStartTime="[^"]*"/, "");
    content = content.replace(/\s*timeShiftBufferDepth="[^"]*"/, "");
    content = content.replace(/\s*suggestedPresentationDelay="[^"]*"/, "");

    if (!content.includes("mediaPresentationDuration")) {
        const periodDuration = content.match(/\bPeriod[^>]+\bduration="([^"]+)"/)?.[1];
        if (periodDuration) {
            content = content.replace(
                /<MPD /,
                `<MPD mediaPresentationDuration="${periodDuration}" `
            );
        }
    }

    fs.writeFileSync(mpdPath, content, "utf-8");
    return true;
}

/** Folder (aur uske sub-folders) ki saari files ki list - recursive. */
export function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
        const absolutePath = path.join(dirPath, file);
        if (fs.statSync(absolutePath).isDirectory()) {
            getAllFiles(absolutePath, arrayOfFiles);
        } else {
            arrayOfFiles.push(absolutePath);
        }
    }
    return arrayOfFiles;
}
