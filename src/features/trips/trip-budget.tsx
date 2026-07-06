"use client";

import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, Info } from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TripBudget({ trip }: { trip: any }) {
  const { data: items, isLoading } = trpc.planItem.listByTrip.useQuery({ tripId: trip.id });

  const totalSpent = useMemo(() => {
    if (!items) return 0;
    return items.reduce((acc, item) => acc + (item.cost || 0), 0);
  }, [items]);

  const budget = trip.budget || 0;
  const remaining = budget - totalSpent;
  const progress = budget === 0 ? (totalSpent > 0 ? 100 : 0) : Math.min(100, (totalSpent / budget) * 100);
  
  const isOverBudget = budget > 0 && totalSpent > budget;

  const formatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Overview Card */}
      <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card p-6 text-center shadow-md">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Wallet className="h-7 w-7" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">Tổng chi phí dự tính</p>
        <h2 className="mt-1 font-serif text-3xl font-semibold text-foreground">
          {formatter.format(totalSpent)}
        </h2>
        
        {budget > 0 && (
          <div className="mt-6 w-full">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Ngân sách: {formatter.format(budget)}</span>
              <span className={`font-medium ${isOverBudget ? "text-destructive" : "text-green-600"}`}>
                {isOverBudget ? "Vượt ngân sách" : `Còn ${formatter.format(remaining)}`}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all duration-500 ease-out ${
                  isOverBudget ? "bg-destructive" : "bg-accent"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Break down */}
      <div>
        <h3 className="mb-4 text-sm font-medium text-muted-foreground uppercase tracking-wider">Chi tiết chi phí</h3>
        <div className="flex flex-col gap-3">
          {items?.filter((i) => i.cost > 0).length === 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-4 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              Chưa có hoạt động nào phát sinh chi phí.
            </div>
          ) : (
            items
              ?.filter((i) => i.cost > 0)
              .map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex flex-col">
                    <span className="font-medium text-foreground line-clamp-1">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.date} {item.time && `• ${item.time}`}</span>
                  </div>
                  <span className="font-semibold text-accent">{formatter.format(item.cost)}</span>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}
