import { API_BASE_URL, getDeviceId, refreshAccessToken } from "./client";

export interface HomeStreamOptions {
  userId?: string;
  onSection: (section: string, data: any) => void;
  onComplete?: () => void;
  onError?: (error: any) => void;
  signal?: AbortSignal;
}

/**
 * Subscribes to the single Server-Sent Events (SSE) stream for the home page.
 * Streams each home section progressively down a single HTTP connection,
 * eliminating the initial 7x concurrent HTTP request flood on peak load.
 */
export function subscribeHomeStream({
  userId,
  onSection,
  onComplete,
  onError,
  signal,
}: HomeStreamOptions): () => void {
  if (typeof window === "undefined") return () => {};

  const controller = new AbortController();
  const activeSignal = signal || controller.signal;

  let isAborted = false;
  activeSignal.addEventListener("abort", () => {
    isAborted = true;
  });

  (async () => {
    try {
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
      };

      const url = `${API_BASE_URL}/api/home/stream`;

      let response = await fetch(url, {
        method: "GET",
        headers,
        credentials: "include",
        signal: activeSignal,
      });

      // If cookies need refreshing, try refreshing once
      if (response.status === 401) {
        try {
          const refreshed = await refreshAccessToken();
          if (refreshed) {
            response = await fetch(url, {
              method: "GET",
              headers,
              credentials: "include",
              signal: activeSignal,
            });
          }
        } catch {
          // Token refresh failed; fall through to error handling
        }
      }

      if (!response.ok || !response.body) {
        throw new Error(`Failed to connect to home stream (HTTP ${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (!isAborted) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          if (!block.trim()) continue;
          let eventName = "message";
          let dataStr = "";

          const lines = block.split("\n");
          for (const line of lines) {
            if (line.startsWith("event:")) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith("data:")) {
              dataStr += line.slice(5).trim();
            }
          }

          if (dataStr) {
            try {
              const parsed = JSON.parse(dataStr);
              if (eventName === "complete") {
                onComplete?.();
              } else {
                onSection(eventName, parsed);
              }
            } catch (err) {
              console.warn(`[HomeStream] Failed to parse JSON for event '${eventName}':`, err);
            }
          }
        }
      }

      onComplete?.();
    } catch (err: any) {
      if (!isAborted && err.name !== "AbortError") {
        if (!err.message?.includes("401") && !err.message?.includes("Unauthenticated")) {
          console.warn("[HomeStream] Stream disconnected, falling back to standard queries:", err?.message);
        }
        onError?.(err);
      }
    }
  })();

  return () => {
    isAborted = true;
    controller.abort();
  };
}
