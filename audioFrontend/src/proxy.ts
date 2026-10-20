import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function isTokenValid(token: string | undefined): boolean {
  if (!token || typeof token !== "string") return false;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonStr =
      typeof atob === "function"
        ? atob(base64)
        : Buffer.from(base64, "base64").toString("utf-8");
    const payload = JSON.parse(jsonStr);
    if (payload.exp && typeof payload.exp === "number") {
      const now = Math.floor(Date.now() / 1000);
      if (now >= payload.exp) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function updateCookieHeader(
  existingHeader: string | null,
  cookiesToUpdate: Record<string, string>
): string {
  const map = new Map<string, string>();
  if (existingHeader) {
    existingHeader.split(";").forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx > -1) {
        map.set(pair.substring(0, idx).trim(), pair.substring(idx + 1).trim());
      }
    });
  }
  for (const [key, val] of Object.entries(cookiesToUpdate)) {
    if (val) {
      map.set(key, val);
    } else {
      map.delete(key);
    }
  }
  return Array.from(map.entries())
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
}

async function refreshCookies(
  refreshToken: string,
  deviceId?: string
): Promise<{ accessToken: string; refreshToken?: string } | null> {
  try {
    const backendUrl =
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:9090";
    const res = await fetch(`${backendUrl}/auth/refresh-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Cookies": "true",
        "X-Accept-Cookies": "true",
        "X-Refresh-Token": refreshToken,
        ...(deviceId ? { "X-Device-Id": deviceId } : {}),
        Cookie: `system_refresh_token=${refreshToken}`,
      },
      body: JSON.stringify({ refreshToken, deviceId }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data?.accessToken) {
      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || refreshToken,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const rawToken = request.cookies.get("system_token")?.value;
  const rawRefreshToken = request.cookies.get("system_refresh_token")?.value;

  const isForcedSignout =
    searchParams.has("session_expired") ||
    searchParams.has("auth_error") ||
    searchParams.has("logout");

  // Public assets, next internals, api routes, manifest, sw, images, icons
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isAuthPage =
    pathname === "/" || pathname === "/login" || pathname === "/signup";

  if (isForcedSignout) {
    const response = isAuthPage
      ? NextResponse.next()
      : NextResponse.redirect(new URL("/signup?session_expired=1", request.url));
    response.cookies.delete("system_token");
    response.cookies.delete("system_refresh_token");
    return response;
  }

  let isAccessTokenValid = isTokenValid(rawToken);
  let refreshedTokens: { accessToken: string; refreshToken?: string } | null =
    null;

  const rawDeviceId =
    request.cookies.get("melody_device_id")?.value ||
    request.headers.get("x-device-id") ||
    undefined;

  // 🔄 AUTO-REFRESH ACCESS COOKIE: If access token is missing/expired, refresh it using refresh token
  if (!isAccessTokenValid && rawRefreshToken && isTokenValid(rawRefreshToken)) {
    refreshedTokens = await refreshCookies(rawRefreshToken, rawDeviceId);
    if (refreshedTokens?.accessToken) {
      isAccessTokenValid = true;
    }
  }

  // If already authenticated and navigating to login/signup/landing, redirect to /home
  if (isAccessTokenValid && isAuthPage) {
    const requestHeaders = new Headers(request.headers);
    if (refreshedTokens) {
      const updatedCookieStr = updateCookieHeader(request.headers.get("cookie"), {
        system_token: refreshedTokens.accessToken,
        system_refresh_token: refreshedTokens.refreshToken || "",
      });
      requestHeaders.set("cookie", updatedCookieStr);
    }
    const response = NextResponse.redirect(new URL("/home", request.url));
    if (refreshedTokens) {
      response.cookies.set("system_token", refreshedTokens.accessToken, {
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
        sameSite: "lax",
        httpOnly: false,
      });
      if (refreshedTokens.refreshToken) {
        response.cookies.set(
          "system_refresh_token",
          refreshedTokens.refreshToken,
          {
            path: "/",
            maxAge: 30 * 24 * 60 * 60,
            sameSite: "lax",
            httpOnly: false,
          }
        );
      }
    }
    return response;
  }

  // If unauthenticated (no valid access token and refresh failed/missing) and accessing protected routes
  if (!isAccessTokenValid && !isAuthPage) {
    const redirectUrl = new URL("/signup", request.url);
    if (rawToken || rawRefreshToken) {
      redirectUrl.searchParams.set("session_expired", "1");
    }
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("system_token");
    response.cookies.delete("system_refresh_token");
    return response;
  }

  // If accessing auth page with completely invalid session, ensure cookies are cleared
  if (isAuthPage && !isAccessTokenValid && (rawToken || rawRefreshToken)) {
    const response = NextResponse.next();
    response.cookies.delete("system_token");
    response.cookies.delete("system_refresh_token");
    return response;
  }

  // If on protected page and token was refreshed, forward updated cookie to downstream request headers
  // so Server Components (e.g. RootLayout) receive the fresh token and never duplicate refresh calls.
  if (refreshedTokens) {
    const requestHeaders = new Headers(request.headers);
    const updatedCookieStr = updateCookieHeader(request.headers.get("cookie"), {
      system_token: refreshedTokens.accessToken,
      system_refresh_token: refreshedTokens.refreshToken || "",
    });
    requestHeaders.set("cookie", updatedCookieStr);

    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    response.cookies.set("system_token", refreshedTokens.accessToken, {
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
      sameSite: "lax",
      httpOnly: false,
    });
    if (refreshedTokens.refreshToken) {
      response.cookies.set(
        "system_refresh_token",
        refreshedTokens.refreshToken,
        {
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
          sameSite: "lax",
          httpOnly: false,
        }
      );
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)",
  ],
};
