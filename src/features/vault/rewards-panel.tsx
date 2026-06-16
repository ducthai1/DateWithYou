"use client";

import { useState } from "react";
import { Coins, Gift, ListChecks, Plus, CheckCircle2, History, Ticket } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { useCelebrate } from "@/components/ui/celebrate";
import { cn } from "@/lib/utils";

// Small grant/redeem chip
const CHIP =
  "inline-flex items-center gap-1 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:pointer-events-none";

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

  const celebrate = useCelebrate();

  if (data.isLoading || !data.data)
    return <div className="py-10 text-center"><p className="text-muted-foreground text-sm">Đang tải…</p></div>;
    
  const { tasks, vouchers, balances, recentLogs } = data.data;
  const label = (b: { isMe: boolean }) => (b.isMe ? "Bạn" : "Người ấy");

  // Determine progress to next voucher for "Me"
  const myBalance = balances.find(b => b.isMe)?.balance || 0;
  const availableVouchers = vouchers.filter(v => !v.redeemed).sort((a, b) => a.cost - b.cost);
  const nextVoucher = availableVouchers.find(v => v.cost > myBalance);
  
  function handleComplete(taskId: string, forUserId: string, anchorEl?: HTMLElement | null) {
    complete.mutate({ taskId, forUserId });
    celebrate(anchorEl);
  }

  function handleRedeem(voucherId: string, forUserId: string, anchorEl?: HTMLElement | null) {
    redeem.mutate({ voucherId, forUserId });
    celebrate(anchorEl);
  }

  return (
    <div className="space-y-8">
      {/* Balances Hero */}
      <section className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {balances.map((b) => (
            <Card
              key={b.userId}
              className={cn(
                "relative overflow-hidden p-5 transition-all",
                b.isMe 
                  ? "border-accent/30 bg-gradient-to-br from-accent-soft to-background shadow-md" 
                  : "bg-muted/30"
              )}
            >
              <div className="relative z-10 flex flex-col gap-1">
                <p className={cn("text-sm font-medium", b.isMe ? "text-accent-foreground/80" : "text-muted-foreground")}>
                  Điểm của {label(b).toLowerCase()}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className={cn("text-4xl font-bold tracking-tight", b.isMe ? "text-accent-foreground" : "")}>
                    {b.balance}
                  </span>
                  <span className={cn("text-lg font-semibold", b.isMe ? "text-accent-foreground/70" : "text-muted-foreground")}>đ</span>
                </div>
              </div>
              <div className="absolute -right-4 -top-4 opacity-[0.08]">
                <Coins className={cn("h-24 w-24", b.isMe ? "text-accent" : "")} />
              </div>
            </Card>
          ))}
        </div>

        {/* Progress to next voucher */}
        {nextVoucher && (
          <div className="bg-muted rounded-xl p-4 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-muted-foreground font-medium">Đổi "{nextVoucher.title}"</span>
              <span className="font-semibold">{myBalance} / {nextVoucher.cost}đ</span>
            </div>
            <div className="bg-background h-2.5 w-full overflow-hidden rounded-full">
              <div 
                className="bg-accent h-full transition-all duration-500 ease-out"
                style={{ width: `${Math.min(100, (myBalance / nextVoucher.cost) * 100)}%` }}
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Cố lên! Bạn cần thêm <strong className="text-foreground">{nextVoucher.cost - myBalance}đ</strong> nữa.
            </p>
          </div>
        )}
      </section>

      {/* Activity Feed */}
      {recentLogs && recentLogs.length > 0 && (
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <History className="text-accent h-4 w-4" /> Hoạt động gần đây
          </h3>
          <div className="space-y-2">
            {recentLogs.map((log) => {
              const isMe = balances.find(b => b.userId === log.userId)?.isMe;
              return (
                <div key={log.id} className="flex items-center gap-3 text-sm">
                  <span className="bg-emerald-100 text-emerald-700 flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 leading-snug">
                    <span className="font-medium">{isMe ? "Bạn" : "Người ấy"}</span> đã nhận{" "}
                    <span className="text-accent font-semibold">{log.points}đ</span> từ{" "}
                    <span className="text-muted-foreground">"{log.taskTitle}"</span>
                  </div>
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {formatDistanceToNow(log.doneAt, { locale: vi, addSuffix: true })}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Tasks */}
      <section className="space-y-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <ListChecks className="text-accent h-4 w-4" /> Danh sách nhiệm vụ
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
            disabled={!taskTitle.trim() || createTask.isPending}
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
          <StaggerList gap="space-y-3">
            {tasks.map((t) => (
              <Card key={t.id} className="group flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:border-accent/40 transition-colors">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold leading-tight">{t.title}</h4>
                    <span className="text-accent mt-1 inline-block font-medium text-sm">+{t.points}đ</span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2 border-t border-border pt-3 sm:border-0 sm:pt-0">
                  {balances.map((b) => (
                    <button
                      key={b.userId}
                      className={CHIP}
                      onClick={(e) => handleComplete(t.id, b.userId, (e.target as HTMLElement).closest('.group') as HTMLElement | null)}
                      disabled={complete.isPending}
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
      <section className="space-y-4">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Gift className="text-accent h-4 w-4" /> Phần thưởng (Voucher)
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
            disabled={!vTitle.trim() || createVoucher.isPending}
            onClick={() => createVoucher.mutate({ title: vTitle.trim(), cost: Number(vCost) || 1 })}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {redeem.error && (
          <div className="bg-destructive-soft text-destructive rounded-lg p-3 text-sm font-medium">
            {redeem.error.message === "INSUFFICIENT_POINTS" ? "Không đủ điểm để đổi voucher này." : "Voucher này đã được đổi rồi."}
          </div>
        )}
        {vouchers.length === 0 ? (
          <EmptyState
            icon="gift"
            title="Chưa có phần thưởng"
            subtitle="Đặt vài voucher để đổi điểm với nhau."
          />
        ) : (
          <StaggerList gap="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {vouchers.map((v) => (
              <Card 
                key={v.id} 
                className={cn(
                  "group relative overflow-hidden border-2 p-0 transition-all",
                  v.redeemed ? "opacity-60 grayscale-[0.3]" : "hover:border-accent/40"
                )}
              >
                {/* Coupon aesthetic */}
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-dashed border-border bg-muted/30 p-3">
                    <span className="text-muted-foreground text-xs font-semibold tracking-widest uppercase">VOUCHER</span>
                    <Badge tone={v.redeemed ? "neutral" : "accent"} className="text-sm font-bold shadow-sm px-2">
                      {v.cost}đ
                    </Badge>
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-4 gap-4">
                    <h4 className={cn("font-semibold leading-snug text-lg", v.redeemed && "line-through decoration-2 text-muted-foreground")}>
                      {v.title}
                    </h4>
                    
                    {v.redeemed ? (
                      <div className="mt-2 inline-flex w-fit items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-sm font-semibold text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4" /> Đã đổi
                      </div>
                    ) : (
                      <div className="mt-2 flex shrink-0 gap-2">
                        {balances.map((b) => {
                          const canAfford = b.balance >= v.cost;
                          return (
                            <button
                              key={b.userId}
                              className={cn(
                                "flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition-all",
                                canAfford 
                                  ? "bg-accent-soft text-accent hover:bg-accent hover:text-accent-foreground shadow-sm"
                                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed"
                              )}
                              onClick={(e) => canAfford && handleRedeem(v.id, b.userId, (e.target as HTMLElement).closest('.group') as HTMLElement | null)}
                              disabled={redeem.isPending || !canAfford}
                            >
                              <Ticket className="h-3.5 w-3.5" /> Đổi ({label(b)})
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Left/Right circle cutouts for ticket effect */}
                <div className="absolute -left-3 top-[38px] h-6 w-6 rounded-full bg-background border-r-2 border-border" />
                <div className="absolute -right-3 top-[38px] h-6 w-6 rounded-full bg-background border-l-2 border-border" />
                
                {/* STAMP */}
                {v.redeemed && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
                    <div className="border-4 border-foreground/20 text-foreground/20 rotate-[-15deg] rounded-lg px-4 py-2 text-2xl font-black tracking-widest uppercase backdrop-blur-[2px]">
                      ĐÃ DÙNG
                    </div>
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
