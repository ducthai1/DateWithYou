"use client";

import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, MapPin } from "lucide-react";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { PlanItemForm } from "@/features/calendar/plan-item-form";
import { BUCKET_ORDER, BUCKETS } from "@/lib/plan-meta";
import { todayKey, addDaysKey } from "@/lib/date-keys";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TripItinerary({ trip }: { trip: any }) {
  const { data: items, isLoading } = trpc.planItem.listByTrip.useQuery({ tripId: trip.id });
  const [formOpen, setFormOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editItem, setEditItem] = useState<any>(null);
  
  // We can prefill date for new items to the trip's start date
  const [prefillDate, setPrefillDate] = useState(trip.startDate);

  // Group items by date, then by bucket
  const grouped = useMemo(() => {
    if (!items) return [];
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byDate: Record<string, any[]> = {};
    
    // Generate all dates in the trip range even if empty
    let curr = trip.startDate;
    while (curr <= trip.endDate) {
      byDate[curr] = [];
      curr = addDaysKey(curr, 1);
    }
    
    // Populate
    for (const item of items) {
      if (!byDate[item.date]) byDate[item.date] = [];
      byDate[item.date].push(item);
    }
    
    // Convert to array
    return Object.keys(byDate).sort().map(date => ({
      date,
      items: byDate[date]
    }));
  }, [items, trip.startDate, trip.endDate]);

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  const handleCreateNew = (date: string) => {
    setPrefillDate(date);
    setEditItem(null);
    setFormOpen(true);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEdit = (item: any) => {
    setEditItem(item);
    setFormOpen(true);
  };

const getBucketStyles = (bucket: string) => {
  switch (bucket) {
    case "morning":
      return "bg-amber-100 text-amber-700";
    case "noon":
      return "bg-orange-100 text-orange-700";
    case "afternoon":
      return "bg-blue-100 text-blue-700";
    case "evening":
      return "bg-indigo-100 text-indigo-700";
    default:
      return "bg-muted text-muted-foreground";
  }
};

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(({ date, items: dayItems }) => {
        const hasItems = dayItems.length > 0;
        
        return (
          <div key={date} className="relative pl-7">
            {/* Timeline track */}
            <div className="absolute bottom-[-24px] left-2 top-3 w-[2px] rounded-full bg-accent/20" />
            
            {/* Date Node */}
            <div className="absolute left-2 top-2.5 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-background ring-4 ring-background">
              <div className="h-2.5 w-2.5 rounded-full bg-accent shadow-sm" />
            </div>
            
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-serif text-lg font-bold text-foreground tracking-tight">
                {date === todayKey() ? "Hôm nay" : date}
              </h3>
              <button
                onClick={() => handleCreateNew(date)}
                className="flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-accent/90 active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm hoạt động
              </button>
            </div>
            
            {!hasItems ? (
              <div className="rounded-2xl border border-dashed border-border bg-background/50 py-8 text-center text-sm text-muted-foreground shadow-sm">
                Chưa có lịch trình cho ngày này.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleEdit(item)}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-border/50 bg-card p-4 text-left shadow-sm transition-all hover:border-accent/40 hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h4 className="font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-accent transition-colors">
                        {item.title}
                      </h4>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${getBucketStyles(item.bucket)}`}>
                        {BUCKETS.find(b => b.key === item.bucket)?.label}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-medium text-muted-foreground">
                      {item.time && (
                        <span className="flex items-center gap-1.5 rounded-md bg-muted/50 px-2 py-1">
                          <Clock className="h-3.5 w-3.5" />
                          {item.time}
                        </span>
                      )}
                      {item.locationId && (
                        <span className="flex items-center gap-1.5 rounded-md bg-blue-50/50 px-2 py-1 text-blue-600">
                          <MapPin className="h-3.5 w-3.5" />
                          Có địa điểm
                        </span>
                      )}
                      {item.cost > 0 && (
                        <span className="flex items-center gap-1.5 rounded-md bg-green-50/50 px-2 py-1 text-green-600">
                          {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(item.cost)}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {formOpen && (
        <Modal open onClose={() => setFormOpen(false)} className="max-w-lg">
          <ModalHeader 
            title={editItem ? "Cập nhật hoạt động" : "Thêm hoạt động"} 
            onClose={() => setFormOpen(false)} 
          />
          <PlanItemForm
            date={editItem ? editItem.date : prefillDate}
            tripId={trip.id}
            item={editItem}
            onDone={() => setFormOpen(false)}
            onCancel={() => setFormOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
