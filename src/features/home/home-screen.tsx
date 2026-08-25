"use client";

/**
 * "Hôm nay" — the app's only withdrawal surface.
 *
 * Every other screen asks the couple to deposit something (log a trip, seal a
 * capsule, plan a route). This one hands them something back in three seconds:
 * a capsule that just unlocked, a milestone about to land, what's on today, a
 * memory from this date years ago. It is the post-login landing route.
 *
 * All of it comes from ONE query (`dashboard.today`) so opening the app is a
 * single round-trip, not six waterfalled ones.
 */

import type { inferRouterOutputs } from "@trpc/server";
import { trpc } from "@/lib/trpc";
import type { AppRouter } from "@/server/trpc/root";
import { StaggerList } from "@/components/ui/stagger-list";
import { HomeGreeting } from "./home-greeting";
import { HomeSkeleton, HomeError } from "./home-states";
import { CapsuleReadyCard } from "./capsule-ready-card";
import { MilestoneCard, SpecialDateCountdownCard } from "./milestone-card";
import { TodayPlansCard } from "./today-plans-card";
import { OnThisDayCard } from "./on-this-day-card";
import { UpcomingCard } from "./upcoming-card";
import { ActivityLinkCard } from "./activity-link-card";
import { FirstRunPanel } from "./first-run-panel";
import { HomeSearchLink } from "./home-search-link";
import { StatsPanel } from "@/features/stats/stats-panel";

export function HomeScreen() {
  const today = trpc.dashboard.today.useQuery();
  const data = today.data;

  return (
    <div className="mx-auto w-full max-w-[760px] space-y-5 px-4 pt-6 pb-6 md:px-[30px]">
      <HomeGreeting daysTogether={data?.daysTogether ?? null} pending={!data} />
      <HomeSearchLink />

      {today.isPending ? (
        <HomeSkeleton />
      ) : today.isError ? (
        <HomeError onRetry={() => void today.refetch()} retrying={today.isRefetching} />
      ) : data ? (
        <>
          <StaggerList className="space-y-4">{buildCards(data)}</StaggerList>
          {/* Warm reminiscence, deliberately last: it rewards scrolling to the
              bottom rather than competing with today's actionable cards. It
              fetches on its own so a slow count never delays the cards above. */}
          <StatsPanel className="pt-2" />
        </>
      ) : null}
    </div>
  );
}

type TodayData = inferRouterOutputs<AppRouter>["dashboard"]["today"];

/**
 * Card order = most-earned attention first. Sections that would render as an
 * empty box are either given a warm one-line prompt or dropped entirely — a
 * brand-new couple gets the FirstRunPanel instead of a wall of nothing.
 */
function buildCards(data: TodayData): React.ReactNode[] {
  const cards: React.ReactNode[] = [];

  if (data.capsulesReady.length > 0) {
    cards.push(<CapsuleReadyCard key="capsule" capsules={data.capsulesReady} />);
  }

  if (data.milestone && data.daysTogether !== null) {
    cards.push(
      <MilestoneCard
        key="milestone"
        milestone={data.milestone}
        daysTogether={data.daysTogether}
      />,
    );
  }

  if (data.nextSpecialDate) {
    cards.push(<SpecialDateCountdownCard key="special" event={data.nextSpecialDate} />);
  }

  // Nothing has been deposited yet: one invitation beats four empty sections.
  const bare =
    !data.hasAnyMemory && !data.hasAnyPlan && data.capsulesReady.length === 0;

  if (bare) {
    cards.push(
      <FirstRunPanel key="first-run" hasAnniversary={data.daysTogether !== null} />,
    );
    return cards;
  }

  cards.push(
    <TodayPlansCard key="today" items={data.todayPlans} hasAnyPlan={data.hasAnyPlan} />,
  );

  // Self-hides for an established couple with no match on this date.
  const onThisDay = (
    <OnThisDayCard
      key="on-this-day"
      memories={data.onThisDay}
      hasAnyMemory={data.hasAnyMemory}
    />
  );
  if (data.onThisDay.length > 0 || !data.hasAnyMemory) cards.push(onThisDay);

  cards.push(
    <UpcomingCard
      key="upcoming"
      items={data.upcomingPlans}
      today={data.today}
      hasAnyPlan={data.hasAnyPlan}
    />,
  );

  cards.push(<ActivityLinkCard key="activity" />);

  return cards;
}
