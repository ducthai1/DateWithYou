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
import { capsuleRouter } from "@/server/trpc/routers/capsule";
import { tripRouter } from "@/server/trpc/routers/trip";
import { rideRouter } from "@/server/trpc/routers/ride";
import { interactionRouter } from "@/server/trpc/routers/interaction";
import { activityRouter } from "@/server/trpc/routers/activity";
import { dashboardRouter } from "@/server/trpc/routers/dashboard";
import { searchRouter } from "@/server/trpc/routers/search";
import { statsRouter } from "@/server/trpc/routers/stats";
import { pushRouter } from "@/server/trpc/routers/push";
import { blogRouter } from "@/server/trpc/routers/blog";
import { uploadRouter } from "@/server/trpc/routers/upload";

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
  capsule: capsuleRouter,
  trip: tripRouter,
  ride: rideRouter,
  interaction: interactionRouter,
  activity: activityRouter,
  dashboard: dashboardRouter,
  search: searchRouter,
  stats: statsRouter,
  push: pushRouter,
  blog: blogRouter,
  upload: uploadRouter,
});

export type AppRouter = typeof appRouter;
