"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ScrollStrip } from "@/components/ui/scroll-strip";
import Link from "next/link";
import { ChevronLeft, Settings2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
import { PageHeader, PageShell } from "@/components/layout/page-shell";
import { TRIP_STATUS_META, tripDay } from "@/lib/trip-status";
import { TripItinerary } from "./trip-itinerary";
import { TripChecklist } from "./trip-checklist";
import { TripBudget } from "./trip-budget";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { TripForm } from "./trip-form";

const TABS = [
  { key: "itinerary", label: "Lịch trình" },
  { key: "checklist", label: "Hành trang" },
  { key: "budget", label: "Ngân sách" },
] as const;

export function TripDetail({ id }: { id: string }) {
  const { data: trip, isLoading } = trpc.trip.get.useQuery({ id });
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["key"]>("itinerary");
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Null unless today falls inside the trip, so the counter never renders
  // "ngày 0" for a trip that has not left yet.
  const day = trip ? tripDay(trip.startDate, trip.endDate) : null;

  if (isLoading) {
    return (
      <PageShell className="space-y-4">
        <Skeleton className="mb-4 h-12 w-12 rounded-full" />
        <Skeleton className="mb-2 h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </PageShell>
    );
  }

  if (!trip) {
    return (
      <PageShell className="space-y-4">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="mb-4 text-lg font-medium">Không tìm thấy chuyến đi</p>
          <Link href="/trips" className="text-accent underline">
            Quay lại danh sách
          </Link>
        </div>
      </PageShell>
    );
  }

  /*
   * PageShell, like every other screen.
   *
   * This one used to build its own page: `min-h-dvh`, its own sticky app-bar,
   * a tab strip pinned at a hard-coded `top-[65px]` measured off that bar, and
   * `bg-background` painted across both. On a phone that reads as a normal
   * full-screen view. On desktop the app is cards floating over artwork, and an
   * opaque slab the height of the window sat beside the floating sidebar
   * looking like a different product — which is exactly what it was, a mobile
   * page dropped into a desktop shell.
   *
   * The shell already supplies the parts this was reimplementing: a header row
   * that does not scroll, the artwork band, the page column, and a scroll box
   * underneath. Nothing here is sticky any more except the tabs, and those
   * carry a translucent card of their own rather than a full-width opaque bar.
   */
  return (
    <PageShell
      className="space-y-5"
      header={
        <PageHeader
          title={trip.title}
          subtitle={`${trip.startDate} — ${trip.endDate}`}
          art="bannerSub"
          artPosition="center 40%"
          actions={
            <div className="flex items-center gap-2">
              <Link
                href="/trips"
                aria-label="Quay lại danh sách chuyến đi"
                className="bg-card/90 text-foreground hover:bg-card flex h-10 w-10 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-colors"
              >
                <ChevronLeft className="h-5 w-5" />
              </Link>
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="Cài đặt chuyến đi"
                className="bg-card/90 text-foreground hover:bg-card flex h-10 w-10 items-center justify-center rounded-full shadow-sm backdrop-blur-md transition-colors"
              >
                <Settings2 className="h-5 w-5" />
              </button>
            </div>
          }
        />
      }
    >
      <div className="mx-auto w-full max-w-4xl space-y-5">
        {/* Where the trip is in its own dates. Nothing to press: it says what
            the calendar says, and the calendar is what was already chosen. */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1.5 text-[11px] font-semibold",
              trip.status === "active"
                ? "bg-accent text-accent-foreground"
                : "bg-muted text-muted-foreground",
            )}
          >
            {TRIP_STATUS_META[trip.status].full}
          </span>
          {trip.status === "active" && day && (
            <span className="border-accent/30 text-accent rounded-full border px-3 py-1.5 text-[11px] font-semibold">
              Ngày {day.day}/{day.total}
            </span>
          )}
        </div>

        {/*
          Sticky inside the scroll box, on a card of its own.
          A full-width opaque bar is what made the old version look pasted on;
          the same translucent card the rest of the app floats on keeps the
          artwork visible behind it while the labels stay readable.
        */}
        <div className="bg-card/85 sticky top-0 z-10 rounded-2xl p-1.5 shadow-sm backdrop-blur-md">
          {/* Scrolls rather than compressing: three labels forced into 320px
              pushed the page wider than the screen once they stopped wrapping. */}
          <ScrollStrip>
            <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} className="w-max sm:w-full" />
          </ScrollStrip>
        </div>

        {activeTab === "itinerary" && <TripItinerary trip={trip} />}
        {activeTab === "checklist" && <TripChecklist trip={trip} />}
        {activeTab === "budget" && <TripBudget trip={trip} />}
      </div>

      {settingsOpen && (
        <Modal open onClose={() => setSettingsOpen(false)} className="max-w-xl">
          <ModalHeader title="Cài đặt chuyến đi" onClose={() => setSettingsOpen(false)} />
          <TripForm trip={trip} onSuccess={() => setSettingsOpen(false)} />
        </Modal>
      )}
    </PageShell>
  );
}
