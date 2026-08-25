import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Optimistic auth gate: redirect users without a session cookie to /sign-in.
 * This is a UX guard only — every tRPC procedure is still authorised server-side.
 */
export function middleware(request: NextRequest) {
  const session = getSessionCookie(request);
  if (!session) {
    const url = new URL("/sign-in", request.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/onboarding/:path*",
    "/settings/:path*",
    "/calendar/:path*",
    "/library/:path*",
    "/map/:path*",
    "/wheel/:path*",
    "/timeline/:path*",
    "/vault/:path*",
    "/home/:path*",
    "/activity/:path*",
    "/search/:path*",
  ],
};
