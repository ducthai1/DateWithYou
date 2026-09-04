"use client";

import Link from "next/link";
import { Plane } from "lucide-react";
import { HomeSection } from "./home-section";
import { PlanRow, type HomePlanItem } from "./today-plans-card";
import { bucketLabel } from "./home-format";
import type { TripStatus } from "@/lib/trip-status";

export type HomeActiveTrip = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  status: TripStatus;
  day: number;
  totalDays: number;
  items: HomePlanItem[];
  doneCount: number;
  nextItem: HomePlanItem | null;
};

/**
 * The trip today belongs to, leading the "Hôm nay" screen.
 *
 * A couple already away is not having an ordinary day, and the screen used to
 * show them one: their itinerary scattered among the same flat list as a
 * dentist appointment, with nothing saying which day of the trip it was. The
 * trip's own items move up here so they are read as a journey rather than as
 * errands, and the card leads with the two facts a traveller wants — which day
 * this is, and what is next.
 *
 * It appears whenever today falls inside the trip's dates, even if nobody
 * marked the trip as under way; the offer to mark it rides along on the nudge
 * bar. Waiting for a switch to be flipped would hide the screen's whole point
 * at exactly the moment it matters.
 */
export function ActiveTripCard({ trip }: { trip: HomeActiveTrip }) {
  const total = trip.items.length;
  const remaining = total - trip.doneCount;

  return (
    <HomeSection
      Icon={Plane}
      /* Today is inside the trip's dates or this card would not be here, so
         there is no "not started yet" case left to word around. */
      title={trip.title}
      link={{ href: `/trips/${trip.id}`, label: "Mở chuyến" }}
      highlight
    >
      <div className="space-y-3">
        {/* Day counter and progress, on one line: the two numbers a traveller
            checks, without a chart to read them out of. */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="bg-accent text-accent-foreground rounded-full px-3 py-1 text-xs font-semibold">
            Ngày {trip.day}/{trip.totalDays}
          </span>
          {total > 0 && (
            <span className="text-muted-foreground text-xs">
              {remaining === 0
                ? `Xong hết ${total} việc của hôm nay rồi 🎉`
                : `${trip.doneCount}/${total} việc hôm nay`}
            </span>
          )}
        </div>

        {/* Only worth calling out when there is something to pick it out FROM.
            With one item left the line just says the same thing twice, once as
            a heading and once as the list under it. */}
        {trip.nextItem && total > 1 && (
          /* Next up, spelled out rather than left for the reader to find in the
             list below — on a trip this is the one line worth reading first. */
          <p className="text-foreground/80 text-sm">
            <span className="text-accent font-semibold">Tiếp theo</span>{" "}
            <span className="font-medium">{trip.nextItem.title}</span>
            <span className="text-muted-foreground">
              {" · "}
              {trip.nextItem.time ?? bucketLabel(trip.nextItem.bucket)}
            </span>
          </p>
        )}

        {total > 0 ? (
          <ul className="space-y-0.5">
            {trip.items.map((it) => (
              <PlanRow key={it.id} item={it} />
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Hôm nay chưa có gì trong lịch trình — cứ đi theo cảm hứng cũng được.{" "}
            <Link href={`/trips/${trip.id}`} className="text-accent font-medium">
              Thêm vào lịch trình
            </Link>
          </p>
        )}
      </div>
    </HomeSection>
  );
}
