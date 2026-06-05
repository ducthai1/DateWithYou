import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@/server/trpc/root";
import { createTRPCContext } from "@/server/trpc/trpc";
import { env } from "@/lib/env";

const allowedOrigin = env.BETTER_AUTH_URL ?? "http://localhost:3000";

/**
 * Reject state-changing requests whose Origin isn't our own app — defense in
 * depth against CSRF on cookie-authenticated mutations. (tRPC's JSON body
 * already blocks simple cross-site form posts; this also covers the rest.)
 */
function originAllowed(req: Request): boolean {
  if (req.method === "GET") return true;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(allowedOrigin).origin;
  } catch {
    return false;
  }
}

const handler = (req: Request) => {
  if (!originAllowed(req)) {
    return new Response("Forbidden origin", { status: 403 });
  }
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: createTRPCContext,
  });
};

export { handler as GET, handler as POST };
