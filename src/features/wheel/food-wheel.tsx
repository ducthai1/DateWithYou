"use client";

import { useState } from "react";
import { motion, useAnimationControls } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { AlertModal } from "@/components/ui/alert-modal";
import { Utensils, Navigation, Loader2 } from "lucide-react";
import { CATEGORIES, type Category } from "@/lib/districts-categories";

const WEDGE_COLORS = ["#c2693f", "#d4a373", "#e9c46a", "#a3b18a", "#cb997e", "#9c5f3c"];

const SOURCE_TABS = [
  { key: "place", label: "Quán xá 📍" },
  { key: "recipe", label: "Tự nấu 👩‍🍳" },
] as const;

export function FoodWheel() {
  const [source, setSource] = useState<(typeof SOURCE_TABS)[number]["key"]>("place");
  const [category, setCategory] = useState("");
  const [inviteError, setInviteError] = useState(false);
  const places = trpc.location.list.useQuery({
    status: "want_to_go",
    category: (category || undefined) as Category | undefined,
  });
  const recipes = trpc.media.list.useQuery({ kind: "recipe" });
  const controls = useAnimationControls();
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<{ id: string; name: string; mustTry: string | null } | null>(null);
  const sendInvite = trpc.location.sendNavInvite.useMutation();

  const handleSendCompanionInvite = (locationId: string, name: string) => {
    sendInvite.mutate(
      { locationId, locationName: name },
      {
        onSuccess: () => {
          setWinner(null);
          // Redirect to map to see the invite waiting state
          window.location.href = "/map";
        },
        onError: () => {
          setInviteError(true);
        }
      }
    );
  };

  // Helper to parse "HH:mm" to minutes
  function parseTime(timeStr?: string | null) {
    if (!timeStr) return null;
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
  }

  // Filter places based on open/close time
  const now = new Date();
  const currentMins = now.getHours() * 60 + now.getMinutes();

  const filteredPlaces = (places.data ?? []).filter((p) => {
    const openMins = parseTime(p.openTime);
    const closeMins = parseTime(p.closeTime);
    
    // If no open/close time specified, keep it
    if (openMins === null || closeMins === null) return true;
    
    // Normal case: 08:00 to 22:00
    if (openMins <= closeMins) {
      return currentMins >= openMins && currentMins <= closeMins;
    } 
    // Overnight case: 18:00 to 02:00
    else {
      return currentMins >= openMins || currentMins <= closeMins;
    }
  });

  // Normalise both sources to { id, name, mustTry } for the wheel.
  const items =
    source === "place"
      ? filteredPlaces.map((p) => ({ id: p.id, name: p.name, mustTry: p.mustTry }))
      : (recipes.data ?? []).map((r) => ({ id: r.id, name: r.title, mustTry: r.recipe?.cookTime ?? null }));

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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-6 px-4 pt-8 pb-28 md:pb-8 md:px-[30px]">
      <h1 className="text-2xl font-semibold">Hôm nay ăn gì?</h1>

      <Tabs tabs={SOURCE_TABS} value={source} onChange={setSource} className="w-full max-w-xs" />

      {source === "place" && (
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
      )}

      <div className="relative h-60 w-60 sm:h-72 sm:w-72">
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
                className="absolute max-w-[68px] truncate text-center text-[10px] sm:max-w-[78px] sm:text-xs font-bold text-white"
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
        <div className="bg-card absolute top-1/2 left-1/2 z-10 flex h-16 w-16 sm:h-20 sm:w-20 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center shadow-md ring-4 ring-white">
          <span className="text-base sm:text-lg leading-none font-semibold">
            {items.length}
          </span>
          <span className="text-muted-foreground text-[10px]">món</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-center text-sm">
          {source === "place"
            ? (places.data && places.data.length > 0)
              ? "Hiện tại không có quán nào trong danh mục này đang mở cửa. Thử đổi danh mục hoặc qua tab Tự nấu nhé!"
              : "Chưa có địa điểm “Muốn đi”. Thêm vài chỗ ở Bản đồ trước nhé."
            : "Chưa có công thức nào. Lưu vài món ở Bộ sưu tập trước nhé."}
        </p>
      ) : (
        <Button onClick={spin} disabled={spinning} className="w-32 sm:w-40 touch-manipulation" style={{ minHeight: 44 }}>
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
              <p className="text-4xl sm:text-5xl">🎉</p>
              <p className="text-xl sm:text-2xl font-semibold">{winner.name}</p>
              {winner.mustTry && (
                <p className="text-muted-foreground flex items-center justify-center gap-1 text-sm">
                  <Utensils className="h-4 w-4" />
                  {winner.mustTry}
                </p>
              )}
              <div className="flex flex-col gap-2 pt-4">
                {source === "place" ? (
                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white border-none shadow-md"
                    disabled={sendInvite.isPending}
                    onClick={() => handleSendCompanionInvite(winner.id, winner.name)}
                  >
                    {sendInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    Rủ người ấy tới đây!
                  </Button>
                ) : (
                  <a
                    href="/library"
                    className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors"
                  >
                    Xem công thức →
                  </a>
                )}
                <Button onClick={() => setWinner(null)} variant="ghost" className="w-full">
                  Quay lại
                </Button>
              </div>
            </div>
          )}
        </ModalContent>
      </Modal>

      <AlertModal
        open={inviteError}
        onClose={() => setInviteError(false)}
        tone="error"
        title="Ơ kìa!"
        message="Lời mời chưa gửi được — thử lại nha 😢"
        actionLabel="Thử lại"
      />
    </div>
  );
}
