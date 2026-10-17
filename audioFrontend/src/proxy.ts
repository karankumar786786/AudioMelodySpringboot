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

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const rawToken = request.cookies.get("system_token")?.value;
  const isForcedSignout =
    searchParams.has("session_expired") ||
    searchParams.has("auth_error") ||
    searchParams.has("logout");

  const isValid = !isForcedSignout && isTokenValid(rawToken);

  const isAuthPage =
    pathname === "/" || pathname === "/login" || pathname === "/signup";

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

  // If already authenticated with a valid token and navigating to login/signup/landing, redirect to /home
  if (isValid && isAuthPage) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // If unauthenticated/expired and accessing protected routes, immediately redirect to /signup and purge cookies
  if (!isValid && !isAuthPage) {
    const redirectUrl = new URL("/signup", request.url);
    if (rawToken) {
      redirectUrl.searchParams.set("session_expired", "1");
    }
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("system_token");
    response.cookies.delete("system_refresh_token");
    return response;
  }

  // If accessing auth page with invalid token or forced signout, wipe stale cookies
  if (isAuthPage && (!isValid || isForcedSignout)) {
    const response = NextResponse.next();
    if (request.cookies.has("system_token")) {
      response.cookies.delete("system_token");
    }
    if (request.cookies.has("system_refresh_token")) {
      response.cookies.delete("system_refresh_token");
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, manifest.webmanifest, sw.js
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js).*)",
  ],
};

