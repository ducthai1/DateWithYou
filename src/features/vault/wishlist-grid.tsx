"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Trash2, Check, Undo2 } from "lucide-react";

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
        <div className="space-y-2">
          {items.map((w) => (
            <Card key={w.id} className="flex items-center justify-between p-3">
              <div>
                <p className={`text-sm ${w.bought ? "text-muted-foreground line-through" : ""}`}>{w.itemName}</p>
                {w.price != null && <p className="text-muted-foreground text-xs">{w.price.toLocaleString("vi-VN")}đ</p>}
              </div>
              <span className="flex items-center gap-2 text-xs">
                <button
                  className="bg-accent-soft text-accent hover:bg-accent hover:text-accent-foreground inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium transition-colors"
                  onClick={() => toggle.mutate({ id: w.id })}
                >
                  {w.bought ? (
                    <>
                      <Undo2 className="h-3.5 w-3.5" /> Bỏ đánh dấu
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" /> Đã mua
                    </>
                  )}
                </button>
                <ConfirmButton
                  idle=""
                  confirm="Xoá?"
                  icon={<Trash2 className="h-4 w-4" />}
                  className="rounded-lg px-2 py-1.5 hover:bg-destructive-soft"
                  onConfirm={() => remove.mutate({ id: w.id })}
                />
              </span>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
