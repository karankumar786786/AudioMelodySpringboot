import { AppState, AppStateStatus, Platform } from "react-native";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { focusManager, onlineManager } from "@tanstack/react-query";

/**
 * Network awareness for the whole app.
 *
 * - React Query's onlineManager follows NetInfo, so queries and mutations pause
 *   while offline and resume (refetch / resumePausedMutations) when the
 *   connection comes back.
 * - focusManager follows AppState, so stale queries refresh when the app
 *   returns to the foreground.
 * - A tiny event channel lets the API layer report requests that failed even
 *   after retries, so the UI can say so instead of failing silently.
 */

function isOnlineFromState(state: NetInfoState): boolean {
  // isInternetReachable is null while unknown; only treat an explicit false as offline.
  return Boolean(state.isConnected) && state.isInternetReachable !== false;
}

let wired = false;

export function setupNetworkAwareness(): void {
  if (wired) return;
  wired = true;

  onlineManager.setEventListener((setOnline) => {
    return NetInfo.addEventListener((state) => {
      setOnline(isOnlineFromState(state));
    });
  });

  if (Platform.OS !== "web") {
    focusManager.setEventListener((handleFocus) => {
      const sub = AppState.addEventListener("change", (status: AppStateStatus) => {
        handleFocus(status === "active");
      });
      return () => sub.remove();
    });
  }
}

export function isOnline(): boolean {
  return onlineManager.isOnline();
}

export type RequestFailureKind = "network" | "server";

type FailureListener = (kind: RequestFailureKind) => void;
const failureListeners = new Set<FailureListener>();

/** Called by the API layer when a request failed for a reason the user should know about. */
export function reportRequestFailure(kind: RequestFailureKind): void {
  failureListeners.forEach((listener) => {
    try {
      listener(kind);
    } catch {}
  });
}

export function subscribeToRequestFailures(listener: FailureListener): () => void {
  failureListeners.add(listener);
  return () => {
    failureListeners.delete(listener);
  };
}
