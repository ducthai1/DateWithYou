import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { PRIVATE_ROUTES } from "@/lib/site";

/**
 * Optimistic auth gate: redirect visitors without a session cookie to /sign-in.
 * This is a UX guard only — every tRPC procedure is still authorised on the
 * server, so a missed route here leaks nothing. It does produce a broken-looking
 * page instead of a clean redirect, which is how the bug below was found.
 *
 * The matched paths used to be a hand-written copy of PRIVATE_ROUTES in the
 * `config.matcher` literal below, and the two drifted: /trips was in
 * PRIVATE_ROUTES and in robots.txt but never made it into the matcher, so
 * /trips answered 200 to a signed-out visitor while every sibling route
 * answered 307. Nothing flagged it, because two hand-kept lists that disagree
 * look correct from either side.
 *
 * Next requires `config.matcher` to be a static literal — it cannot be computed
 * — but the *decision* can be. So the matcher now casts a wide net and the
 * actual test reads PRIVATE_ROUTES directly, leaving exactly one list to
 * maintain. Adding a route to PRIVATE_ROUTES now protects it everywhere:
 * middleware, robots.txt and the app-chrome exclusions.
 */
function isPrivatePath(pathname: string): boolean {
  return PRIVATE_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function middleware(request: NextRequest) {
  if (!isPrivatePath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const session = getSessionCookie(request);
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  /*
   * Everything except Next's own assets, the API, and any path with a file
   * extension. Public pages do reach the middleware now, but they exit at the
   * first check above — the cost is one string comparison per request, paid to
   * remove a duplicated list that had already gone wrong once.
   */
  matcher: ["/((?!_next/static|_next/image|api/|favicon.ico|.*\\.).*)"],
};
