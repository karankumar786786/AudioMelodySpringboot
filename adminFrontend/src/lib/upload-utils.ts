import { adminFetch } from "./adminFetch";

export interface UploadProgressEvent {
  loaded: number;
  total: number;
  percent: number;
  loadedFormatted: string;
  totalFormatted: string;
  speedText: string;
}

export class UploadError extends Error {
  isNetworkError: boolean;
  isTimeout: boolean;
  isOffline: boolean;
  isAborted: boolean;
  canRetry: boolean;
  statusCode?: number;

  constructor(
    message: string,
    options: {
      isNetworkError?: boolean;
      isTimeout?: boolean;
      isOffline?: boolean;
      isAborted?: boolean;
      canRetry?: boolean;
      statusCode?: number;
    } = {},
  ) {
    super(message);
    this.name = "UploadError";
    this.isNetworkError = options.isNetworkError ?? false;
    this.isTimeout = options.isTimeout ?? false;
    this.isOffline = options.isOffline ?? false;
    this.isAborted = options.isAborted ?? false;
    this.canRetry = options.canRetry ?? (this.isNetworkError || this.isTimeout);
    this.statusCode = options.statusCode;
  }
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0 || isNaN(bytes)) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export interface UploadOptions {
  signal?: AbortSignal;
  timeoutMs?: number; // Total max timeout (default: dynamically computed based on file size, min 15 minutes)
  stallTimeoutMs?: number; // Inactivity timeout: if 0 bytes transferred for X ms (default: 45,000ms)
  maxRetries?: number; // default: 4 (increased from 2)
  retryDelayMs?: number; // default: 1500ms
  onRetry?: (
    attempt: number,
    maxRetries: number,
    delayMs: number,
    error: Error,
  ) => void;
}

export function isDeviceOnline(): boolean {
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.onLine === "boolean"
  ) {
    return navigator.onLine;
  }
  return true;
}

export function getFriendlyUploadErrorMessage(err: unknown): {
  title: string;
  message: string;
  isNetworkError: boolean;
  canRetry: boolean;
} {
  if (err instanceof UploadError) {
    if (err.isOffline) {
      return {
        title: "You Are Offline",
        message:
          "Your device is not connected to the internet. Please reconnect and retry.",
        isNetworkError: true,
        canRetry: true,
      };
    }
    if (err.isTimeout) {
      return {
        title: "Upload Timed Out",
        message:
          "The upload stalled or connection was too slow. Your form entries and files are preserved.",
        isNetworkError: true,
        canRetry: true,
      };
    }
    if (err.isAborted) {
      return {
        title: "Upload Cancelled",
        message: "The upload was cancelled.",
        isNetworkError: false,
        canRetry: true,
      };
    }
    if (err.statusCode === 413) {
      return {
        title: "File Exceeds Size Limit",
        message: "The selected file is too large for the upload destination.",
        isNetworkError: false,
        canRetry: false,
      };
    }
    if (err.statusCode === 403) {
      return {
        title: "Authorization Expired",
        message:
          "The upload signature or credentials expired. Please retry to refresh authorization.",
        isNetworkError: true,
        canRetry: true,
      };
    }
    if (err.isNetworkError) {
      return {
        title: "Network Connection Interrupted",
        message:
          "Network connection was interrupted during file transfer. Your form entries and files are preserved.",
        isNetworkError: true,
        canRetry: true,
      };
    }
    return {
      title: "Upload Failed",
      message: err.message,
      isNetworkError: err.isNetworkError,
      canRetry: err.canRetry,
    };
  }

  const rawMsg = (err instanceof Error ? err.message : String(err)) || "";
  const lowerMsg = rawMsg.toLowerCase();

  if (!isDeviceOnline()) {
    return {
      title: "You Are Offline",
      message:
        "Your device lost internet connection. Please reconnect and retry.",
      isNetworkError: true,
      canRetry: true,
    };
  }

  if (
    lowerMsg.includes("failed to fetch") ||
    lowerMsg.includes("networkerror") ||
    lowerMsg.includes("network error") ||
    lowerMsg.includes("load failed") ||
    lowerMsg.includes("econnrefused")
  ) {
    return {
      title: "Network Connection Interrupted",
      message:
        "Unable to complete transfer. Please check your internet connection.",
      isNetworkError: true,
      canRetry: true,
    };
  }

  if (lowerMsg.includes("timed out") || lowerMsg.includes("timeout")) {
    return {
      title: "Upload Timed Out",
      message: "The upload timed out while transferring data over the network.",
      isNetworkError: true,
      canRetry: true,
    };
  }

  if (lowerMsg.includes("abort")) {
    return {
      title: "Upload Cancelled",
      message: "The upload was cancelled.",
      isNetworkError: false,
      canRetry: true,
    };
  }

  return {
    title: "Upload Failed",
    message:
      rawMsg || "An unexpected error occurred during upload. Please try again.",
    isNetworkError: false,
    canRetry: true,
  };
}

/**
 * Low-level single attempt of XMLHttpRequest upload with progress, stall detection, and dynamic timeout.
 */
function singleUploadAttempt(
  url: string,
  body: File | Blob | FormData,
  method: "PUT" | "POST",
  headers: Record<string, string>,
  onProgress?: (progress: UploadProgressEvent) => void,
  options?: UploadOptions,
): Promise<{ status: number; responseText: string }> {
  return new Promise((resolve, reject) => {
    if (!isDeviceOnline()) {
      return reject(
        new UploadError(
          "You appear to be offline. Please check your internet connection.",
          { isOffline: true, isNetworkError: true, canRetry: true },
        ),
      );
    }

    if (options?.signal?.aborted) {
      return reject(
        new UploadError("Upload cancelled by user", {
          isAborted: true,
          canRetry: false,
        }),
      );
    }

    const fileSize = body instanceof Blob ? body.size : 0;
    // Dynamic timeout: At least 15 minutes, or enough time even at 20 KB/s for large video files
    const defaultTotalTimeout = Math.max(
      900000,
      Math.ceil(fileSize / (20 * 1024)) * 1000,
    );
    const totalTimeoutMs = options?.timeoutMs ?? defaultTotalTimeout;
    const stallTimeoutMs = options?.stallTimeoutMs ?? 45000; // 45s without any progress

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    let lastProgressTime = startTime;
    let isSettled = false;

    xhr.open(method, url, true);
    xhr.timeout = totalTimeoutMs;

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    const cleanup = () => {
      isSettled = true;
      clearInterval(stallInterval);
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
    };

    const abortHandler = () => {
      cleanup();
      xhr.abort();
      reject(
        new UploadError("Upload cancelled by user", {
          isAborted: true,
          canRetry: false,
        }),
      );
    };

    if (options?.signal) {
      options.signal.addEventListener("abort", abortHandler, { once: true });
    }

    // Stall checker: fires if 0 bytes transferred for stallTimeoutMs
    const stallInterval = setInterval(() => {
      if (isSettled) return;
      const now = Date.now();
      if (now - lastProgressTime > stallTimeoutMs && lastLoaded < fileSize) {
        cleanup();
        console.warn(
          `[UPLOAD] Connection stalled (${stallTimeoutMs / 1000}s without progress). Aborting attempt.`,
        );
        xhr.abort();
        reject(
          new UploadError(
            "Upload connection stalled. Network stopped transmitting data.",
            {
              isNetworkError: true,
              isTimeout: true,
              canRetry: true,
            },
          ),
        );
      }
    }, 5000);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const now = Date.now();
          if (event.loaded > lastLoaded) {
            lastProgressTime = now;
          }

          // If all bytes left browser, cap at 99% until server 200 OK headers return
          const isFinishedSending = event.loaded >= event.total;
          const percent = isFinishedSending
            ? 99
            : Math.min(98, Math.round((event.loaded / event.total) * 100));

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
      cleanup();

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
        const isTransientServerErr =
          xhr.status === 408 ||
          xhr.status === 429 ||
          (xhr.status >= 500 && xhr.status <= 504);
        const isAuthExpired = xhr.status === 403;

        console.error(
          `[UPLOAD] Server returned HTTP ${xhr.status}:`,
          xhr.responseText || xhr.statusText,
        );

        reject(
          new UploadError(
            `Upload failed with HTTP status ${xhr.status}: ${
              xhr.responseText || xhr.statusText
            }`,
            {
              statusCode: xhr.status,
              isNetworkError: isTransientServerErr || isAuthExpired,
              canRetry: isTransientServerErr || isAuthExpired,
            },
          ),
        );
      }
    };

    xhr.onerror = () => {
      cleanup();
      const offline = !isDeviceOnline();
      console.error(
        "[UPLOAD] Network error occurred during upload. Offline:",
        offline,
      );
      reject(
        new UploadError(
          offline
            ? "Network connection lost. You appear to be offline."
            : "Network error during file upload. Please check your connection.",
          {
            isNetworkError: true,
            isOffline: offline,
            canRetry: true,
          },
        ),
      );
    };

    xhr.ontimeout = () => {
      cleanup();
      console.warn(
        `[UPLOAD] File upload timed out after ${totalTimeoutMs / 1000}s.`,
      );
      reject(
        new UploadError(
          "File upload timed out. Network connection was too slow.",
          {
            isNetworkError: true,
            isTimeout: true,
            canRetry: true,
          },
        ),
      );
    };

    xhr.send(body);
  });
}

/**
 * Upload any File, Blob, or FormData with real-time XMLHttpRequest progress reporting,
 * offline awareness, stall detection, abort signal support, and automatic retries with exponential backoff.
 */
export async function uploadWithProgress(
  url: string,
  body: File | Blob | FormData,
  method: "PUT" | "POST" = "PUT",
  headers: Record<string, string> = {},
  onProgress?: (progress: UploadProgressEvent) => void,
  options?: UploadOptions,
): Promise<{ status: number; responseText: string }> {
  const maxRetries = options?.maxRetries ?? 4;
  const initialDelay = options?.retryDelayMs ?? 1500;

  let attempt = 0;

  while (true) {
    try {
      return await singleUploadAttempt(
        url,
        body,
        method,
        headers,
        onProgress,
        options,
      );
    } catch (err: any) {
      attempt++;

      const isAborted =
        options?.signal?.aborted ||
        (err instanceof UploadError && err.isAborted);
      const isRetryable =
        !isAborted &&
        attempt <= maxRetries &&
        (err instanceof UploadError
          ? err.canRetry
          : String(err?.message || "")
              .toLowerCase()
              .includes("network"));

      if (!isRetryable) {
        throw err;
      }

      const delayMs = Math.min(30000, initialDelay * 2 ** (attempt - 1));
      if (options?.onRetry) {
        options.onRetry(attempt, maxRetries, delayMs, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Authorize and upload a file to AWS S3 with full byte-level progress reporting,
 * automatic fresh presigned URL refresh on each retry attempt, stall detection,
 * and resilient network recovery.
 */
export async function uploadToS3WithProgress(
  file: File | Blob,
  getUrlEndpoint: string, // e.g. "/webhook/internal/song-upload-url" or "/webhook/internal/video-upload-url"
  contentType?: string,
  onProgress?: (progress: UploadProgressEvent) => void,
  options?: UploadOptions,
): Promise<{ key: string; status: number }> {
  if (!isDeviceOnline()) {
    throw new UploadError(
      "You appear to be offline. Please reconnect and retry.",
      { isOffline: true, isNetworkError: true, canRetry: true },
    );
  }

  const maxRetries = options?.maxRetries ?? 4;
  const initialDelay = options?.retryDelayMs ?? 1500;
  let attempt = 0;

  while (true) {
    try {
      // 1. Get fresh pre-signed upload URL from backend
      let urlRes: Response;
      try {
        urlRes = await adminFetch(getUrlEndpoint, {
          signal: options?.signal,
        });
      } catch (fetchErr: any) {
        throw new UploadError(
          `Failed to reach authorization endpoint: ${fetchErr?.message || "Network error"}`,
          { isNetworkError: true, canRetry: true },
        );
      }

      if (!urlRes.ok) {
        throw new UploadError("Failed to get S3 upload authorization", {
          statusCode: urlRes.status,
          canRetry: urlRes.status >= 500,
        });
      }

      const urlData = await urlRes.json();
      if (!urlData?.preSignedUrl) {
        throw new UploadError("Invalid presigned URL received from server", {
          canRetry: false,
        });
      }

      // 2. Upload file to S3 with progress and stall detection (single attempt per outer loop)
      const mimeType =
        contentType ||
        (file instanceof File ? file.type : "") ||
        "application/octet-stream";

      const result = await uploadWithProgress(
        urlData.preSignedUrl,
        file,
        "PUT",
        { "Content-Type": mimeType },
        onProgress,
        {
          ...options,
          maxRetries: 0, // Handled here at the outer loop to ensure a fresh pre-signed URL on each retry!
        },
      );

      return { key: urlData.key, status: result.status };
    } catch (err: any) {
      attempt++;

      const isAborted =
        options?.signal?.aborted ||
        (err instanceof UploadError && err.isAborted);
      const isRetryable =
        !isAborted &&
        attempt <= maxRetries &&
        (err instanceof UploadError
          ? err.canRetry
          : String(err?.message || "")
              .toLowerCase()
              .includes("network"));

      if (!isRetryable) {
        throw err;
      }

      const delayMs = Math.min(30000, initialDelay * 2 ** (attempt - 1));
      if (options?.onRetry) {
        options.onRetry(attempt, maxRetries, delayMs, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Authorize and upload a file to ImageKit with full byte-level progress reporting,
 * network resilience, and automatic token refresh on retry.
 */
export async function uploadToImageKitWithProgress(
  file: File,
  folder: string,
  onProgress?: (progress: UploadProgressEvent) => void,
  options?: UploadOptions,
): Promise<string> {
  if (!isDeviceOnline()) {
    throw new UploadError(
      "You appear to be offline. Please reconnect and retry.",
      { isOffline: true, isNetworkError: true, canRetry: true },
    );
  }

  const maxRetries = options?.maxRetries ?? 4;
  const initialDelay = options?.retryDelayMs ?? 1500;
  let attempt = 0;

  while (true) {
    try {
      // 1. Get fresh signature authorization from backend
      let sigRes: Response;
      try {
        sigRes = await adminFetch("/webhook/internal/image-upload-param", {
          signal: options?.signal,
        });
      } catch (fetchErr: any) {
        throw new UploadError(
          `Failed to reach authorization endpoint: ${fetchErr?.message || "Network error"}`,
          { isNetworkError: true, canRetry: true },
        );
      }

      if (!sigRes.ok) {
        throw new UploadError("Failed to get ImageKit upload authorization", {
          statusCode: sigRes.status,
          canRetry: sigRes.status >= 500,
        });
      }

      const sigData = await sigRes.json();

      // 2. Build FormData payload
      const fd = new FormData();
      fd.append("file", file);
      fd.append(
        "publicKey",
        process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ||
          "public_ck50bJ3UfF9eCOXhwXQTQFP693o=",
      );
      fd.append("signature", sigData.param.signature);
      fd.append("expire", sigData.param.expire.toString());
      fd.append("token", sigData.param.token);
      fd.append("folder", folder);
      const extension = file.name.split(".").pop();
      fd.append("fileName", `${sigData.key}.${extension}`);

      // 3. Upload with real-time progress (single attempt per outer loop to refresh signature on retry)
      const result = await uploadWithProgress(
        "https://upload.imagekit.io/api/v1/files/upload",
        fd,
        "POST",
        {},
        onProgress,
        {
          ...options,
          maxRetries: 0, // Handled at outer loop to re-obtain signature if needed
        },
      );

      const data = JSON.parse(result.responseText);
      return data.filePath || sigData.key;
    } catch (err: any) {
      attempt++;

      const isAborted =
        options?.signal?.aborted ||
        (err instanceof UploadError && err.isAborted);
      const isRetryable =
        !isAborted &&
        attempt <= maxRetries &&
        (err instanceof UploadError
          ? err.canRetry
          : String(err?.message || "")
              .toLowerCase()
              .includes("network"));

      if (!isRetryable) {
        throw err;
      }

      const delayMs = Math.min(30000, initialDelay * 2 ** (attempt - 1));
      if (options?.onRetry) {
        options.onRetry(attempt, maxRetries, delayMs, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
