import { adminFetch } from "./adminFetch";

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
  loadedFormatted: string;
  totalFormatted: string;
  speedText: string;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Upload any File, Blob, or FormData with real-time XMLHttpRequest progress reporting.
 */
export function uploadWithProgress(
  url: string,
  body: File | Blob | FormData,
  method: "PUT" | "POST" = "PUT",
  headers: Record<string, string> = {},
  onProgress?: (progress: UploadProgressEvent) => void
): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.open(method, url, true);

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const now = Date.now();
          const percent = Math.min(100, Math.round((event.loaded / event.total) * 100));
          
          // Calculate transfer speed smoothed over intervals
          const timeDiff = (now - lastTime) / 1000;
          let speedText = "";
          if (timeDiff > 0.2) {
            const bytesDiff = event.loaded - lastLoaded;
            const bytesPerSec = bytesDiff / timeDiff;
            speedText = `${formatBytes(bytesPerSec)}/s`;
            lastLoaded = event.loaded;
            lastTime = now;
          } else if (event.loaded === event.total) {
            const totalTime = Math.max(0.1, (now - startTime) / 1000);
            speedText = `${formatBytes(event.total / totalTime)}/s`;
          }

          onProgress({
            loaded: event.loaded,
            total: event.total,
            percent,
            loadedFormatted: formatBytes(event.loaded),
            totalFormatted: formatBytes(event.total),
            speedText,
          });
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        if (onProgress) {
          const totalBytes = body instanceof Blob ? body.size : 100;
          onProgress({
            loaded: totalBytes,
            total: totalBytes,
            percent: 100,
            loadedFormatted: formatBytes(totalBytes),
            totalFormatted: formatBytes(totalBytes),
            speedText: "",
          });
        }
        resolve({ status: xhr.status, responseText: xhr.responseText });
      } else {
        reject(new Error(`Upload failed with HTTP status ${xhr.status}: ${xhr.responseText || xhr.statusText}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Network error during file upload. Please check your connection."));
    };

    xhr.ontimeout = () => {
      reject(new Error("File upload timed out."));
    };

    xhr.send(body);
  });
}

/**
 * Authorize and upload a file to ImageKit with full byte-level progress reporting.
 */
export async function uploadToImageKitWithProgress(
  file: File,
  folder: string,
  onProgress?: (progress: UploadProgressEvent) => void
): Promise<string> {
  // 1. Get signature authorization from backend
  const sigRes = await adminFetch("/webhook/internal/image-upload-param");
  if (!sigRes.ok) throw new Error("Failed to get ImageKit upload authorization");
  const sigData = await sigRes.json();

  // 2. Build FormData payload
  const fd = new FormData();
  fd.append("file", file);
  fd.append(
    "publicKey",
    process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "public_ck50bJ3UfF9eCOXhwXQTQFP693o="
  );
  fd.append("signature", sigData.param.signature);
  fd.append("expire", sigData.param.expire.toString());
  fd.append("token", sigData.param.token);
  fd.append("folder", folder);
  const extension = file.name.split(".").pop();
  fd.append("fileName", `${sigData.key}.${extension}`);

  // 3. Upload with real-time progress
  const result = await uploadWithProgress(
    "https://upload.imagekit.io/api/v1/files/upload",
    fd,
    "POST",
    {},
    onProgress
  );

  const data = JSON.parse(result.responseText);
  return data.filePath || sigData.key;
}
