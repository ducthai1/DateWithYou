"use client";

import { PENDING_TASKS } from "@/lib/pending-tasks";
import { AdminOnly } from "./admin-only";

const WEIGHT_ORDER = { cao: 0, vừa: 1, thấp: 2 } as const;
const WEIGHT_CLASS: Record<string, string> = {
  cao: "bg-destructive-soft text-destructive",
  vừa: "bg-accent-soft text-accent-ink",
  thấp: "bg-muted text-muted-foreground",
};

/** Việc đã biết mà chưa làm, nặng trước nhẹ sau. */
export function TaskList() {
  const tasks = [...PENDING_TASKS].sort((a, b) => WEIGHT_ORDER[a.weight] - WEIGHT_ORDER[b.weight]);
  return (
    <AdminOnly>
      {tasks.length === 0 ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Không còn việc nào đang chờ. 🎉
        </p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <li key={t.title} className="border-border bg-card rounded-2xl border p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${WEIGHT_CLASS[t.weight]}`}>
                  {t.weight}
                </span>
                <span className="text-muted-foreground text-[11px]">{t.area}</span>
              </div>
              <p className="mt-2 font-medium">{t.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{t.why}</p>
            </li>
          ))}
        </ul>
      )}
    </AdminOnly>
  );
}
