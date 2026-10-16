/**
 * Universal cookie helpers for audioFrontend.
 * Manages client-side cookie synchronization so Next.js Server Components (RSC)
 * can access auth tokens via `cookies()` in HTTP request headers.
 */

export function setCookie(
  name: string,
  value: string,
  options: {
    days?: number;
    path?: string;
    sameSite?: "lax" | "strict" | "none";
    secure?: boolean;
  } = {}
): void {
  if (typeof document === "undefined") return;

  const {
    days = 7,
    path = "/",
    sameSite = "lax",
    secure = typeof window !== "undefined" && window.location.protocol === "https:",
  } = options;

  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = `; expires=${date.toUTCString()}; max-age=${days * 24 * 60 * 60}`;
  }

  const secureFlag = secure ? "; Secure" : "";
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(
    value
  )}${expires}; path=${path}; SameSite=${sameSite}${secureFlag}`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const nameEQ = `${encodeURIComponent(name)}=`;
  const cookies = document.cookie.split(";");

  for (let i = 0; i < cookies.length; i++) {
    let c = cookies[i].trim();
    if (c.indexOf(nameEQ) === 0) {
      try {
        return decodeURIComponent(c.substring(nameEQ.length));
      } catch {
        return c.substring(nameEQ.length);
      }
    }
  }
  return null;
}

export function deleteCookie(name: string, path = "/"): void {
  if (typeof document === "undefined") return;
  document.cookie = `${encodeURIComponent(
    name
  )}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; path=${path}; SameSite=lax`;
}

export interface AuthTokensPayload {
  accessToken: string;
  refreshToken?: string | null;
  user?: any;
}

/**
 * Persists system authentication tokens and user payload into cookies for Next.js SSR.
 */
export function saveAuthCookies(payload: AuthTokensPayload): void {
  if (typeof window === "undefined") return;

  if (payload.accessToken) {
    setCookie("system_token", payload.accessToken, { days: 7 });
  }

  if (payload.refreshToken) {
    setCookie("system_refresh_token", payload.refreshToken, { days: 30 });
  }

  if (payload.user) {
    try {
      const userStr = typeof payload.user === "string" ? payload.user : JSON.stringify(payload.user);
      setCookie("system_user", userStr, { days: 30 });
    } catch (e) {
      console.warn("[Cookies] Failed to serialize user object for cookie:", e);
    }
  }
}

/**
 * Purges all authentication tokens and session cookies upon logout or expiration.
 */
export function clearAuthCookies(): void {
  if (typeof window === "undefined") return;
  deleteCookie("system_token");
  deleteCookie("system_refresh_token");
  deleteCookie("system_user");
}

/**
 * Two-way sync between localStorage and document.cookie.
 * Ensures existing active sessions automatically populate cookies for SSR,
 * and cookies can re-hydrate localStorage if needed.
 */
export function syncStorageToCookies(): void {
  if (typeof window === "undefined") return;

  const localToken = localStorage.getItem("system_token");
  const localRefreshToken = localStorage.getItem("system_refresh_token");
  const localUser = localStorage.getItem("system_user");

  const cookieToken = getCookie("system_token");

  // If localStorage has an existing session but cookie is missing, migrate to cookie
  if (localToken && !cookieToken) {
    setCookie("system_token", localToken, { days: 7 });
    if (localRefreshToken) {
      setCookie("system_refresh_token", localRefreshToken, { days: 30 });
    }
    if (localUser) {
      setCookie("system_user", localUser, { days: 30 });
    }
    return;
  }

  // If cookie exists but localStorage is missing, mirror to localStorage
  if (cookieToken && !localToken) {
    localStorage.setItem("system_token", cookieToken);
    const cookieRefreshToken = getCookie("system_refresh_token");
    if (cookieRefreshToken) {
      localStorage.setItem("system_refresh_token", cookieRefreshToken);
    }
    const cookieUser = getCookie("system_user");
    if (cookieUser) {
      localStorage.setItem("system_user", cookieUser);
    }
  }
}
