import "server-only";
import { appRouter } from "@/server/trpc/root";
import { createCallerFactory } from "@/server/trpc/trpc";

/**
 * A tRPC caller for Server Components, run as a guest.
 *
 * Blog pages are public and rendered on the server (SSG/ISR), so they call the
 * router directly here — no HTTP round-trip, and nothing shipped to the client.
 * The context is empty (no user), which is exactly what a public procedure
 * wants; anything requiring auth would correctly throw.
 */
const createCaller = createCallerFactory(appRouter);

export const publicCaller = createCaller({
  userId: null,
  userEmail: null,
  activeSpaceId: null,
});
