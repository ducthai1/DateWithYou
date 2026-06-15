import { router } from "@/server/trpc/trpc";
import { healthRouter } from "@/server/trpc/routers/health";
import { spaceRouter } from "@/server/trpc/routers/space";
import { locationRouter } from "@/server/trpc/routers/location";
import { memoryRouter } from "@/server/trpc/routers/memory";
import { planRouter } from "@/server/trpc/routers/plan";
import { wishlistRouter } from "@/server/trpc/routers/wishlist";
import { rewardRouter } from "@/server/trpc/routers/reward";
import { planItemRouter } from "@/server/trpc/routers/plan-item";
import { specialDateRouter } from "@/server/trpc/routers/special-date";
import { calendarRouter } from "@/server/trpc/routers/calendar";
import { mediaRouter } from "@/server/trpc/routers/media";

/** Root tRPC router. Each feature registers its own sub-router here. */
export const appRouter = router({
  health: healthRouter,
  space: spaceRouter,
  location: locationRouter,
  memory: memoryRouter,
  plan: planRouter,
  wishlist: wishlistRouter,
  reward: rewardRouter,
  planItem: planItemRouter,
  specialDate: specialDateRouter,
  calendar: calendarRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
