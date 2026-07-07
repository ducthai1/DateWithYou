"use client";

import { useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Plane, Plus, CalendarDays, Wallet, CheckSquare, Map } from "lucide-react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { TripForm } from "./trip-form";
import { cn } from "@/lib/utils";

export function TripList() {
  const { data: trips, isLoading } = trpc.trip.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-[30px] md:py-8">
      <div className="mb-6 flex items-center justify-between rounded-2xl bg-gradient-to-r from-gradient-from/15 to-gradient-to/15 p-4 -mx-1">
        <h1 className="flex items-center gap-2 font-serif text-2xl font-semibold text-accent">
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

      <div className="grid gap-5 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <>
            <Skeleton className="h-64 rounded-2xl" />
            <Skeleton className="h-64 rounded-2xl" />
          </>
        ) : !trips?.length ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
            <Plane className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-lg font-medium">Chưa có chuyến đi nào.</p>
            <p className="text-sm mt-1">Hãy tạo chuyến đi đầu tiên của hai bạn nhé!</p>
          </div>
        ) : (
          trips.map((trip) => {
            const d1 = new Date(trip.startDate);
            const d2 = new Date(trip.endDate);
            const diffDays = Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            
            const totalChecklist = trip.checklists?.length || 0;
            const doneChecklist = trip.checklists?.filter((c: { isDone: boolean }) => c.isDone).length || 0;
            
            return (
              <Link
                key={trip.id}
                href={`/trips/${trip.id}`}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-accent/40 active:scale-[0.98]"
              >
                {/* Decorative Top Banner */}
                <div className="relative h-24 bg-gradient-to-br from-gradient-from/20 to-gradient-to/30 p-4 overflow-hidden">
                  <Map className="absolute -right-4 -bottom-4 h-24 w-24 text-accent/10 rotate-12" />
                  
                  {/* Status Pill */}
                  <div className="absolute top-3 right-3">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-wide shadow-sm backdrop-blur-md",
                        trip.status === "completed"
                          ? "bg-green-100/90 text-green-700"
                          : trip.status === "upcoming"
                          ? "bg-blue-100/90 text-blue-700"
                          : "bg-orange-100/90 text-orange-700"
                      )}
                    >
                      {trip.status === "completed"
                        ? "ĐÃ XONG"
                        : trip.status === "upcoming"
                        ? "SẮP ĐI"
                        : "LÊN KẾ HOẠCH"}
                    </span>
                  </div>
                  
                  <div className="flex h-full items-end relative z-10">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 shadow-sm backdrop-blur-md">
                        <Plane className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-accent/90 uppercase tracking-wider bg-white/60 px-2 py-0.5 rounded-md backdrop-blur-sm shadow-sm">
                          {diffDays === 1 ? "Trong ngày" : `${diffDays} ngày ${diffDays - 1} đêm`}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="mb-2 text-xl font-semibold text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                    {trip.title}
                  </h3>
                  {trip.description && (
                    <p className="mb-4 text-sm text-muted-foreground line-clamp-2">{trip.description}</p>
                  )}
                  
                  <div className="mt-auto space-y-4 pt-2">
                    {/* Dates & Budget Grid */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider">Thời gian</span>
                        <span className="flex items-center gap-1.5 font-medium text-foreground text-[13px]">
                          <CalendarDays className="h-4 w-4 text-accent/70" />
                          {/* Format to DD/MM */}
                          {trip.startDate.split("-").slice(1).reverse().join("/")} 
                          <span className="text-muted-foreground">&rarr;</span> 
                          {trip.endDate.split("-").slice(1).reverse().join("/")}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground/70 uppercase tracking-wider">Ngân sách</span>
                        <span className="flex items-center gap-1.5 font-medium text-foreground text-[13px]">
                          <Wallet className="h-4 w-4 text-green-500/80" />
                          {trip.budget > 0 ? `${trip.budget.toLocaleString("vi-VN")} ₫` : "---"}
                        </span>
                      </div>
                    </div>
                    
                    {/* Checklist Progress */}
                    {totalChecklist > 0 && (
                      <div className="pt-3 border-t border-border/60">
                        <div className="flex items-center justify-between text-[11px] font-medium mb-2">
                          <span className="text-muted-foreground flex items-center gap-1.5">
                            <CheckSquare className="h-3.5 w-3.5 text-accent/70" />
                            Hành trang & Chuẩn bị
                          </span>
                          <span className="text-accent font-semibold">{doneChecklist}/{totalChecklist}</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div 
                            className="h-full bg-accent rounded-full transition-all duration-500" 
                            style={{ width: `${(doneChecklist / totalChecklist) * 100}%` }} 
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} className="max-w-xl">
          <ModalHeader title="Tạo chuyến đi mới" onClose={() => setFormOpen(false)} />
          <TripForm onSuccess={() => setFormOpen(false)} />
        </Modal>
      )}
    </div>
  );
}
