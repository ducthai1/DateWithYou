"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Plane, Plus, MapPin, CalendarDays } from "lucide-react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { TripForm } from "./trip-form";

export function TripList() {
  const { data: trips, isLoading } = trpc.trip.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-serif text-3xl font-semibold text-foreground">
          <Plane className="h-7 w-7 text-accent" />
          Chuyến đi
        </h1>
        <button
          onClick={() => setFormOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-md transition-transform hover:scale-105 active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {isLoading ? (
          <>
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </>
        ) : !trips?.length ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12 text-center text-muted-foreground">
            <Plane className="mb-3 h-10 w-10 opacity-20" />
            <p>Chưa có chuyến đi nào.</p>
            <p className="text-sm">Hãy tạo chuyến đi đầu tiên của hai bạn nhé!</p>
          </div>
        ) : (
          trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
            >
              {/* Optional Cover Image logic could go here */}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-foreground line-clamp-2">{trip.title}</h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      trip.status === "completed"
                        ? "bg-green-100 text-green-700"
                        : trip.status === "upcoming"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {trip.status === "completed"
                      ? "Đã xong"
                      : trip.status === "upcoming"
                      ? "Sắp đi"
                      : "Lên kế hoạch"}
                  </span>
                </div>
                {trip.description && (
                  <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{trip.description}</p>
                )}
                <div className="mt-auto flex items-center gap-3 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    {trip.startDate}
                  </span>
                  <span>&rarr;</span>
                  <span>{trip.endDate}</span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} className="max-w-lg">
          <ModalHeader title="Tạo chuyến đi mới" onClose={() => setFormOpen(false)} />
          <TripForm onSuccess={() => setFormOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
