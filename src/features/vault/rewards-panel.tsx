"use client";

import { useState } from "react";
import { Coins, Gift, ListChecks, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { cn } from "@/lib/utils";

// Small grant/redeem chip — terracotta soft, fills on hover.
const CHIP =
  "inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-accent-foreground";

export function RewardsPanel() {
  const data = trpc.reward.overview.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.reward.overview.invalidate();

  const [taskTitle, setTaskTitle] = useState("");
  const [taskPoints, setTaskPoints] = useState("10");
  const [vTitle, setVTitle] = useState("");
  const [vCost, setVCost] = useState("50");

  const createTask = trpc.reward.createTask.useMutation({ onSuccess: () => { setTaskTitle(""); invalidate(); } });
  const createVoucher = trpc.reward.createVoucher.useMutation({ onSuccess: () => { setVTitle(""); invalidate(); } });
  const complete = trpc.reward.completeTask.useMutation({ onSuccess: invalidate });
  const redeem = trpc.reward.redeem.useMutation({ onSuccess: invalidate });

  if (data.isLoading || !data.data)
    return <p className="text-muted-foreground text-sm">Đang tải…</p>;
  const { tasks, vouchers, balances } = data.data;
  const label = (b: { isMe: boolean }) => (b.isMe ? "Bạn" : "Người ấy");

  return (
    <div className="space-y-6">
      {/* Balances */}
      <div className="grid grid-cols-2 gap-3">
        {balances.map((b) => (
          <Card
            key={b.userId}
            className={cn(
              "flex items-center gap-3 p-4",
              b.isMe && "bg-accent-soft border-accent/40",
            )}
          >
            <span className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
              <Coins className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{label(b)}</p>
              <p className="text-2xl leading-tight font-semibold">
                {b.balance}
                <span className="text-base">đ</span>
              </p>
            </div>
          </Card>
        ))}
      </div>

      {/* Tasks */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="text-accent h-4 w-4" /> Nhiệm vụ
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="Nhiệm vụ (vd: Đấm lưng 15p)"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
          />
          <div className="relative w-24 shrink-0">
            <Input
              type="number"
              className="pr-7 text-right"
              value={taskPoints}
              onChange={(e) => setTaskPoints(e.target.value)}
            />
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
              đ
            </span>
          </div>
          <Button
            aria-label="Thêm nhiệm vụ"
            className="shrink-0 px-3"
            disabled={!taskTitle.trim()}
            onClick={() => createTask.mutate({ title: taskTitle.trim(), points: Number(taskPoints) || 1 })}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {tasks.length === 0 ? (
          <EmptyState
            icon="list-checks"
            title="Chưa có nhiệm vụ"
            subtitle="Thêm việc nhỏ để cùng tích điểm."
          />
        ) : (
          <StaggerList gap="space-y-2">
            {tasks.map((t) => (
              <Card key={t.id} className="flex items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm">{t.title}</span>
                  <Badge tone="accent">+{t.points}đ</Badge>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  {balances.map((b) => (
                    <button
                      key={b.userId}
                      className={CHIP}
                      onClick={() => complete.mutate({ taskId: t.id, forUserId: b.userId })}
                    >
                      <Plus className="h-3.5 w-3.5" /> {label(b)}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </StaggerList>
        )}
      </section>

      {/* Vouchers */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Gift className="text-accent h-4 w-4" /> Phần thưởng (voucher)
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="Voucher (vd: Chọn món cuối tuần)"
            value={vTitle}
            onChange={(e) => setVTitle(e.target.value)}
          />
          <div className="relative w-24 shrink-0">
            <Input
              type="number"
              className="pr-7 text-right"
              value={vCost}
              onChange={(e) => setVCost(e.target.value)}
            />
            <span className="text-muted-foreground pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm">
              đ
            </span>
          </div>
          <Button
            aria-label="Thêm voucher"
            className="shrink-0 px-3"
            disabled={!vTitle.trim()}
            onClick={() => createVoucher.mutate({ title: vTitle.trim(), cost: Number(vCost) || 1 })}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {redeem.error && (
          <p className="text-destructive text-xs">
            {redeem.error.message === "INSUFFICIENT_POINTS" ? "Không đủ điểm." : "Đã đổi rồi."}
          </p>
        )}
        {vouchers.length === 0 ? (
          <EmptyState
            icon="gift"
            title="Chưa có phần thưởng"
            subtitle="Đặt vài voucher để đổi điểm với nhau."
          />
        ) : (
          <StaggerList gap="space-y-2">
            {vouchers.map((v) => (
              <Card key={v.id} className="flex items-center justify-between gap-2 p-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className={cn("truncate text-sm", v.redeemed && "text-muted-foreground line-through")}>
                    {v.title}
                  </span>
                  <Badge tone={v.redeemed ? "neutral" : "accent"}>{v.cost}đ</Badge>
                </div>
                {v.redeemed ? (
                  <Badge tone="success">Đã đổi</Badge>
                ) : (
                  <div className="flex shrink-0 gap-1.5">
                    {balances.map((b) => (
                      <button
                        key={b.userId}
                        className={CHIP}
                        onClick={() => redeem.mutate({ voucherId: v.id, forUserId: b.userId })}
                      >
                        <Gift className="h-3.5 w-3.5" /> {label(b)}
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </StaggerList>
        )}
      </section>
    </div>
  );
}
