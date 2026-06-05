"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  if (data.isLoading || !data.data) return <p className="text-muted-foreground text-sm">Đang tải…</p>;
  const { tasks, vouchers, balances } = data.data;
  const label = (b: { isMe: boolean }) => (b.isMe ? "Bạn" : "Người ấy");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        {balances.map((b) => (
          <div key={b.userId} className="border-border rounded-xl border p-3 text-center">
            <p className="text-muted-foreground text-xs">{label(b)}</p>
            <p className="text-2xl font-semibold">{b.balance}đ</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Nhiệm vụ</h3>
        <div className="flex gap-2">
          <Input placeholder="Nhiệm vụ (vd: Đấm lưng 15p)" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
          <Input type="number" className="w-20" value={taskPoints} onChange={(e) => setTaskPoints(e.target.value)} />
          <Button disabled={!taskTitle.trim()} onClick={() => createTask.mutate({ title: taskTitle.trim(), points: Number(taskPoints) || 1 })}>+</Button>
        </div>
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="border-border flex items-center justify-between rounded-xl border p-3 text-sm">
              <span>{t.title} <span className="text-muted-foreground">({t.points}đ)</span></span>
              <span className="flex gap-1 text-xs">
                {balances.map((b) => (
                  <button key={b.userId} className="text-accent" onClick={() => complete.mutate({ taskId: t.id, forUserId: b.userId })}>
                    +{label(b)}
                  </button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Phần thưởng (voucher)</h3>
        <div className="flex gap-2">
          <Input placeholder="Voucher (vd: Chọn món cuối tuần)" value={vTitle} onChange={(e) => setVTitle(e.target.value)} />
          <Input type="number" className="w-20" value={vCost} onChange={(e) => setVCost(e.target.value)} />
          <Button disabled={!vTitle.trim()} onClick={() => createVoucher.mutate({ title: vTitle.trim(), cost: Number(vCost) || 1 })}>+</Button>
        </div>
        {redeem.error && <p className="text-xs text-red-600">{redeem.error.message === "INSUFFICIENT_POINTS" ? "Không đủ điểm." : "Đã đổi rồi."}</p>}
        <ul className="space-y-2">
          {vouchers.map((v) => (
            <li key={v.id} className="border-border flex items-center justify-between rounded-xl border p-3 text-sm">
              <span className={v.redeemed ? "text-muted-foreground line-through" : ""}>{v.title} <span className="text-muted-foreground">({v.cost}đ)</span></span>
              {v.redeemed ? (
                <span className="text-muted-foreground text-xs">Đã đổi</span>
              ) : (
                <span className="flex gap-1 text-xs">
                  {balances.map((b) => (
                    <button key={b.userId} className="text-accent" onClick={() => redeem.mutate({ voucherId: v.id, forUserId: b.userId })}>
                      Đổi ({label(b)})
                    </button>
                  ))}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
