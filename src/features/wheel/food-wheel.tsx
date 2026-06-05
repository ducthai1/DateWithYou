"use client";

import { useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { CATEGORIES, type Category } from "@/lib/districts-categories";

const WEDGE_COLORS = ["#b08968", "#d4a373", "#e9c46a", "#a3b18a", "#cb997e", "#bc8a5f"];

export function FoodWheel() {
  const [category, setCategory] = useState("");
  const list = trpc.location.list.useQuery({
    status: "want_to_go",
    category: (category || undefined) as Category | undefined,
  });
  const controls = useAnimationControls();
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<{ id: string; name: string; mustTry: string | null } | null>(null);

  const items = list.data ?? [];

  async function spin() {
    if (items.length === 0 || spinning) return;
    setSpinning(true);
    setWinner(null);
    const index = Math.floor(Math.random() * items.length);
    const seg = 360 / items.length;
    // Land the chosen wedge centre under the top pointer, after 5 full turns.
    const target = 360 * 5 + (360 - (index * seg + seg / 2));
    await controls.start({
      rotate: target,
      transition: { duration: 3.2, ease: [0.17, 0.67, 0.12, 0.99] },
    });
    const w = items[index];
    setWinner({ id: w.id, name: w.name, mustTry: w.mustTry });
    setSpinning(false);
    await controls.set({ rotate: target % 360 });
  }

  const gradient =
    items.length > 0
      ? `conic-gradient(${items
          .map((_, i) => {
            const c = WEDGE_COLORS[i % WEDGE_COLORS.length];
            const seg = 100 / items.length;
            return `${c} ${i * seg}% ${(i + 1) * seg}%`;
          })
          .join(", ")})`
      : "var(--muted)";

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">Hôm nay ăn gì?</h1>

      <Select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="max-w-xs"
      >
        <option value="">Mọi danh mục</option>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>

      <div className="relative flex h-64 w-64 items-center justify-center">
        <div className="absolute -top-1 z-10 text-2xl">▼</div>
        <motion.div
          animate={controls}
          className="h-60 w-60 rounded-full border-4 border-white shadow-lg"
          style={{ background: gradient }}
        />
        <div className="bg-background absolute flex h-16 w-16 items-center justify-center rounded-full text-xs shadow">
          {items.length}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          Chưa có địa điểm “Muốn đi”. Thêm vài chỗ ở Bản đồ trước nhé.
        </p>
      ) : (
        <Button onClick={spin} disabled={spinning} className="w-40">
          {spinning ? "Đang quay…" : "Quay!"}
        </Button>
      )}

      {winner && (
        <div className="border-border w-full rounded-xl border p-4 text-center">
          <p className="text-muted-foreground text-xs">Tụi mình đi…</p>
          <p className="text-xl font-semibold">{winner.name}</p>
          {winner.mustTry && <p className="text-sm">🍽 {winner.mustTry}</p>}
          <a href="/map" className="text-accent mt-2 inline-block text-sm">
            Xem trên bản đồ →
          </a>
        </div>
      )}
    </div>
  );
}
