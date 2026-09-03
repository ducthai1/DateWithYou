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
import { ActiveTripCard } from "./active-trip-card";
import { OnThisDayCard } from "./on-this-day-card";
import { UpcomingCard } from "./upcoming-card";
import { ActivityLinkCard } from "./activity-link-card";
import { FirstRunPanel } from "./first-run-panel";
import { HomeSearchLink } from "./home-search-link";
import { PageShell } from "@/components/layout/page-shell";
import { StatsPanel } from "@/features/stats/stats-panel";

export function HomeScreen() {
  const today = trpc.dashboard.today.useQuery();
  const data = today.data;

  return (
    /*
     * The shell is the standard 1400px column now, the same as every other
     * screen — a narrower one made the page start and end at a different place
     * than the route you just came from, which reads as the app settling rather
     * than as a design.
     *
     * The CONTENT does not simply stretch with it. These are cards of short
     * text, and one sentence spread across 1400px is worse than the 760px it
     * had. The extra width buys a second column from lg instead, which is what
     * the space is actually good for.
     */
    <PageShell
      className="space-y-5"
      header={<HomeGreeting daysTogether={data?.daysTogether ?? null} pending={!data} />}
    >
      <HomeSearchLink />

      {today.isPending ? (
        <HomeSkeleton />
      ) : today.isError ? (
        <HomeError onRetry={() => void today.refetch()} retrying={today.isRefetching} />
      ) : data ? (
        <>
          {/* Two columns from lg with a masonry flow: the cards have very
              different heights (a plan list vs a one-line link), and a grid
              would leave a ragged hole beside the tall one. */}
          <StaggerList className="space-y-4 lg:columns-2 lg:gap-4 lg:space-y-0 [&>*]:lg:mb-4 [&>*]:lg:break-inside-avoid">
            {buildCards(data)}
          </StaggerList>
          {/* Warm reminiscence, deliberately last: it rewards scrolling to the
              bottom rather than competing with today's actionable cards. It
              fetches on its own so a slow count never delays the cards above. */}
          <StatsPanel className="pt-2" />
        </>
      ) : null}
    </PageShell>
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

  /*
   * A trip under way outranks everything else on the screen. Nothing else here
   * is time-critical in the same way: a capsule keeps, an anniversary countdown
   * keeps, but "what are we doing next" is the question being asked right now,
   * standing somewhere unfamiliar.
   */
  if (data.activeTrip) {
    cards.push(<ActiveTripCard key="active-trip" trip={data.activeTrip} />);
  }

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

  /*
   * Today's other plans. Items belonging to the running trip are already listed
   * inside its own card above, and showing them twice on one screen made the
   * day look twice as full as it was.
   */
  const otherPlans = data.activeTrip
    ? data.todayPlans.filter((p) => p.tripId !== data.activeTrip!.id)
    : data.todayPlans;
  if (!data.activeTrip || otherPlans.length > 0) {
    cards.push(
      <TodayPlansCard key="today" items={otherPlans} hasAnyPlan={data.hasAnyPlan} />,
    );
  }

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
