import { router } from "@/server/trpc/trpc";
import { healthRouter } from "@/server/trpc/routers/health";
import { spaceRouter } from "@/server/trpc/routers/space";
import { locationRouter } from "@/server/trpc/routers/location";

/**
 * Root tRPC router. Each feature registers its own sub-router here
 * (memory, plan, wishlist, reward in later phases).
 */
export const appRouter = router({
  health: healthRouter,
  space: spaceRouter,
  location: locationRouter,
});

export type AppRouter = typeof appRouter;
