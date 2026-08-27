"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, Settings2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs } from "@/components/ui/tabs";
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

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="mb-4 h-12 w-12 rounded-full" />
        <Skeleton className="mb-2 h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center p-4 text-center">
        <p className="mb-4 text-lg font-medium">Không tìm thấy chuyến đi</p>
        <Link href="/trips" className="text-accent underline">Quay lại danh sách</Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/trips" className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80">
            <ChevronLeft className="h-6 w-6" />
          </Link>
          <div className="flex flex-col">
            <h1 className="font-serif text-lg font-semibold leading-tight line-clamp-1">{trip.title}</h1>
            <span className="text-[11px] text-muted-foreground">{trip.startDate} - {trip.endDate}</span>
          </div>
        </div>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted/80"
        >
          <Settings2 className="h-5 w-5" />
        </button>
      </header>

      {/* Tabs */}
      <div className="sticky top-[65px] z-10 bg-background px-4 pt-3 pb-2 shadow-sm">
        <div className="mx-auto w-full max-w-4xl">
          <Tabs tabs={TABS} value={activeTab} onChange={setActiveTab} className="w-full" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 bg-background px-4 py-6 md:px-[30px] md:py-8">
        <div className="mx-auto w-full max-w-4xl">
          {activeTab === "itinerary" && <TripItinerary trip={trip} />}
          {activeTab === "checklist" && <TripChecklist trip={trip} />}
          {activeTab === "budget" && <TripBudget trip={trip} />}
        </div>
      </div>

      {/* Settings Modal */}
      {settingsOpen && (
        <Modal open onClose={() => setSettingsOpen(false)} className="max-w-xl">
          <ModalHeader title="Cài đặt chuyến đi" onClose={() => setSettingsOpen(false)} />
          <TripForm trip={trip} onSuccess={() => setSettingsOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
