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

  return (
    <div className="flex flex-col gap-6">
      {grouped.map(({ date, items: dayItems }) => {
        const hasItems = dayItems.length > 0;
        
        return (
          <div key={date} className="relative pl-6">
            {/* Timeline track */}
            <div className="absolute bottom-0 left-2 top-2 w-[2px] bg-border" />
            
            {/* Date Node */}
            <div className="absolute left-[3px] top-2 h-3 w-3 rounded-full border-2 border-accent bg-background" />
            
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-serif text-lg font-semibold text-foreground">
                {date === todayKey() ? "Hôm nay" : date}
              </h3>
              <button
                onClick={() => handleCreateNew(date)}
                className="flex items-center gap-1 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              >
                <Plus className="h-3 w-3" />
                Thêm hoạt động
              </button>
            </div>
            
            {!hasItems ? (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
                Chưa có lịch trình cho ngày này.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {dayItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleEdit(item)}
                    className="flex flex-col rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <h4 className="font-medium leading-tight text-foreground line-clamp-2">{item.title}</h4>
                      <span className="shrink-0 text-xs font-medium text-muted-foreground uppercase">
                        {BUCKETS.find(b => b.key === item.bucket)?.label}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      {item.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {item.time}
                        </span>
                      )}
                      {item.locationId && (
                        <span className="flex items-center gap-1 text-blue-500">
                          <MapPin className="h-3.5 w-3.5" />
                          Đã đính kèm địa điểm
                        </span>
                      )}
                      {item.cost > 0 && (
                        <span className="font-medium text-accent">
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
            onSuccess={() => setFormOpen(false)}
          />
        </Modal>
      )}
    </div>
  );
}
