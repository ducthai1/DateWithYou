"use client";

import { useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { Utensils } from "lucide-react";
import { CATEGORIES, type Category } from "@/lib/districts-categories";

const WEDGE_COLORS = ["#c2693f", "#d4a373", "#e9c46a", "#a3b18a", "#cb997e", "#9c5f3c"];

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
        aria-label="Lọc danh mục"
        className="max-w-xs"
        value={category}
        onChange={setCategory}
        options={[
          { value: "", label: "Mọi danh mục" },
          ...CATEGORIES.map((c) => ({ value: c, label: c })),
        ]}
      />

      <div className="relative h-72 w-72">
        {/* Pointer (fixed, above the spinning wheel). */}
        <div className="border-t-accent absolute top-0 left-1/2 z-20 h-0 w-0 -translate-x-1/2 border-x-[11px] border-t-[18px] border-x-transparent drop-shadow" />

        <motion.div
          animate={controls}
          className="relative h-full w-full overflow-hidden rounded-full border-4 border-white shadow-lg"
          style={{ background: gradient }}
        >
          {/* Labels sit on their wedge and rotate with the wheel. */}
          {items.map((it, i) => {
            const seg = 360 / items.length;
            const angle = i * seg + seg / 2;
            const rad = ((angle - 90) * Math.PI) / 180;
            const left = 50 + 33 * Math.cos(rad);
            const top = 50 + 33 * Math.sin(rad);
            return (
              <span
                key={it.id}
                className="absolute max-w-[78px] truncate text-center text-xs font-bold text-white"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  transform: `translate(-50%, -50%) rotate(${angle}deg)`,
                  textShadow: "0 1px 3px rgba(0,0,0,.55)",
                }}
              >
                {it.name}
              </span>
            );
          })}
        </motion.div>

        {/* Center hub (does not rotate). */}
        <div className="bg-card absolute top-1/2 left-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center shadow-md ring-4 ring-white">
          <span className="text-lg leading-none font-semibold">
            {items.length}
          </span>
          <span className="text-muted-foreground text-[10px]">món</span>
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

      <Modal
        open={!!winner}
        onClose={() => setWinner(null)}
      >
        <ModalHeader title="Tụi mình đi…" onClose={() => setWinner(null)} />
        <ModalContent>
          {winner && (
            <div className="space-y-3 text-center">
              <p className="text-5xl">🎉</p>
              <p className="text-2xl font-semibold">{winner.name}</p>
              {winner.mustTry && (
                <p className="text-muted-foreground flex items-center justify-center gap-1 text-sm">
                  <Utensils className="h-4 w-4" />
                  {winner.mustTry}
                </p>
              )}
              <div className="flex justify-center gap-2 pt-2">
                <Button onClick={() => setWinner(null)} variant="outline">
                  Quay lại
                </Button>
                <a
                  href="/map"
                  className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-11 items-center rounded-xl px-4 text-sm font-medium transition-colors"
                >
                  Xem trên bản đồ →
                </a>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
