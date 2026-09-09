import type { NextConfig } from "next";
import { NOINDEX_ROUTES, PRIVATE_ROUTES } from "./src/lib/site";

const nextConfig: NextConfig = {
  /*
   * Where the build lands, overridable by env.
   *
   * The default is Next's own build directory, so a normal build or a deploy
   * is unchanged. The override exists because `next build` and `next dev`
   * share that directory: running a production build to verify something while
   * a dev server is up kills the dev server mid-session — measured, and it
   * fails in the confusing way, with the port still held afterwards.
   *
   *   NEXT_DIST_DIR=tmp/vivu-verify npx next build
   *   NEXT_DIST_DIR=tmp/vivu-verify npx next start -p 4491
   *
   * Two things to know before using it:
   *
   * 1. The path is resolved relative to the PROJECT ROOT even when it looks
   *    absolute — `/tmp/vivu-verify` produced `<repo>/tmp/vivu-verify`, which
   *    is not in .gitignore and which `npm run lint` then walked (3,184 errors
   *    out of generated code). Use a relative path and delete it when done.
   * 2. `next build` rewrites `tsconfig.json` on every run, and with an
   *    override it adds the override's `types/**` to `include` and reformats
   *    the file. Check `git diff tsconfig.json` afterwards and restore it.
   */
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Run these as native Node modules instead of bundling them. Better Auth ships
  // optional sqlite (kysely) dialects we don't use; bundling them pulls in a
  // mismatched kysely export and breaks the build. mongoose/mongodb also prefer
  // to stay external on the server.
  serverExternalPackages: [
    "better-auth",
    "@better-auth/kysely-adapter",
    "kysely",
    "mongodb",
    "mongoose",
  ],

  /*
   * Render metadata into <head> instead of streaming it into the body.
   *
   * Next 15 streams metadata tags and relies on React hoisting them into the
   * head on the client. Measured on this app, that hoist does not happen: after
   * full hydration, <title>, the meta description, og:* and rel=canonical were
   * all still sitting in <body>. A canonical link outside <head> is ignored
   * outright by Google, and Lighthouse reports the page as having no meta
   * description.
   *
   * `htmlLimitedBots` is the supported switch for "this client cannot handle
   * streamed metadata, block on it". Widening it to every user agent trades a
   * streaming optimisation we do not benefit from — every generateMetadata here
   * is a plain synchronous object, so there is nothing slow to wait for — for
   * metadata that is always in the right place.
   */
  htmlLimitedBots: /.*/,

  /*
   * Keep non-public routes out of the search index.
   *
   * robots.txt only asks a crawler not to FETCH a URL — it does not stop that
   * URL from being indexed when something links to it, and a disallowed page
   * can still surface as a bare link. `X-Robots-Tag: noindex` is the directive
   * that actually removes it. It has to be a header rather than page metadata
   * because several of these screens are "use client" pages, and a Client
   * Component cannot export `metadata` at all.
   */
  async headers() {
    const noindex = {
      key: "X-Robots-Tag",
      value: "noindex, nofollow",
    };

    return [
      // Couple-private app screens: no index, and do not follow onward links.
      ...PRIVATE_ROUTES.map((route) => ({
        source: `${route}/:path*`,
        headers: [noindex],
      })),
      ...PRIVATE_ROUTES.map((route) => ({
        source: route,
        headers: [noindex],
      })),
      // Auth screens stay crawlable (so link equity still flows to the
      // landing page) but are kept out of the index as thin duplicates.
      ...NOINDEX_ROUTES.map((route) => ({
        source: route,
        headers: [{ key: "X-Robots-Tag", value: "noindex, follow" }],
      })),
      {
        source: "/:path*",
        headers: [
          // Stops a browser from MIME-sniffing a response into something
          // executable; one of the checks behind the Best Practices score.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Send the full URL only to ourselves, bare origin cross-site — so
          // an outbound click never leaks a couple-space path.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
