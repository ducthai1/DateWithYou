"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WishlistGrid() {
  const [itemName, setItemName] = useState("");
  const list = trpc.wishlist.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.wishlist.list.invalidate();
  const create = trpc.wishlist.create.useMutation({ onSuccess: () => { setItemName(""); invalidate(); } });
  const toggle = trpc.wishlist.toggleBought.useMutation({ onSuccess: invalidate });
  const remove = trpc.wishlist.remove.useMutation({ onSuccess: invalidate });

  const items = list.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Món quà muốn có…" value={itemName} onChange={(e) => setItemName(e.target.value)} />
        <Button disabled={!itemName.trim() || create.isPending} onClick={() => create.mutate({ itemName: itemName.trim() })}>
          Thêm
        </Button>
      </div>
      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">Chưa có món nào trong wishlist.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((w) => (
            <li key={w.id} className="border-border flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className={`text-sm ${w.bought ? "text-muted-foreground line-through" : ""}`}>{w.itemName}</p>
                {w.price != null && <p className="text-muted-foreground text-xs">{w.price.toLocaleString("vi-VN")}đ</p>}
              </div>
              <span className="flex gap-2 text-xs">
                <button className="text-accent" onClick={() => toggle.mutate({ id: w.id })}>
                  {w.bought ? "Bỏ đánh dấu" : "Đã mua"}
                </button>
                <button className="text-red-500" onClick={() => remove.mutate({ id: w.id })}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
