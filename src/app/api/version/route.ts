/**
 * The build this server is running — for an open page to tell whether it is
 * still on the same one. See `NEXT_PUBLIC_BUILD_ID` in next.config.ts.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "cache-control": "no-store" } },
  );
}
