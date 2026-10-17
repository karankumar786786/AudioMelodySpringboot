import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("system_token")?.value;

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

  // If already authenticated and navigating to login/signup/landing, redirect to /home
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  // If unauthenticated and accessing protected routes, immediately redirect to /signup
  if (!token && !isAuthPage) {
    return NextResponse.redirect(new URL("/signup", request.url));
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
