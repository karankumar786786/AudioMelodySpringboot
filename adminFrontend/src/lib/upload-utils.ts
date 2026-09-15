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
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
}

export interface UploadOptions {
  signal?: AbortSignal;
  timeoutMs?: number; // default: 300,000ms (5 minutes)
  maxRetries?: number; // default: 2
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
          "The network connection is too slow or unresponsive. Please check your signal and retry.",
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
        title: "Network Connection Lost",
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
      title: "Network Connection Lost",
      message:
        "Unable to reach the server. Please check your internet connection or server availability.",
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
 * Low-level single attempt of XMLHttpRequest upload with progress and timeout.
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

    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    xhr.open(method, url, true);
    xhr.timeout = options?.timeoutMs ?? 300000; // 5 minutes default

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    const abortHandler = () => {
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

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          const now = Date.now();
          const percent = Math.min(
            100,
            Math.round((event.loaded / event.total) * 100),
          );

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
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }

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
          (xhr.status >= 502 && xhr.status <= 504);
        const isAuthExpired = xhr.status === 403;

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
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
      const offline = !isDeviceOnline();
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
      if (options?.signal) {
        options.signal.removeEventListener("abort", abortHandler);
      }
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
 * offline awareness, abort signal support, and automatic retries with exponential backoff.
 */
export async function uploadWithProgress(
  url: string,
  body: File | Blob | FormData,
  method: "PUT" | "POST" = "PUT",
  headers: Record<string, string> = {},
  onProgress?: (progress: UploadProgressEvent) => void,
  options?: UploadOptions,
): Promise<{ status: number; responseText: string }> {
  const maxRetries = options?.maxRetries ?? 2;
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

      const delayMs = initialDelay * 2 ** (attempt - 1);
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

  const maxRetries = options?.maxRetries ?? 2;
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

      const delayMs = initialDelay * 2 ** (attempt - 1);
      if (options?.onRetry) {
        options.onRetry(attempt, maxRetries, delayMs, err);
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
