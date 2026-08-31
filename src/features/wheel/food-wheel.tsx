"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-shell";
import { ToneArt } from "@/components/theme/tone-art";
import { motion, useAnimationControls } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { AlertModal } from "@/components/ui/alert-modal";
import { Utensils, Navigation, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, type Category } from "@/lib/districts-categories";

const WEDGE_COLORS = ["#c2693f", "#d4a373", "#e9c46a", "#a3b18a", "#cb997e", "#9c5f3c"];

const SOURCE_TABS = [
  { key: "place", label: "Quán xá 📍" },
  { key: "recipe", label: "Tự nấu 👩‍🍳" },
] as const;

import { useToast } from "@/components/ui/toast";
import { isOpenAt } from "@/lib/maps";

export function FoodWheel() {
  const router = useRouter();
  const toast = useToast();
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
          toast("Đã gửi lời mời", "success");
          setTimeout(() => {
            // Redirect to map to see the invite waiting state
            router.push("/map");
          }, 1000);
        },
        onError: (err) => {
          setInviteError(true);
          toast(err.message || "Gửi lời mời thất bại", "error");
        },
      },
    );
  };

  // Opening-hours filtering uses the shared rule (see isOpenAt) so the wheel
  // and the meeting-point finder cannot disagree about what "open" means.
  const now = new Date();
  const filteredPlaces = (places.data ?? []).filter((p) => isOpenAt(p, now));

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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col items-center gap-6 px-4 pt-6 pb-8 md:px-[30px] short:gap-3 short:pt-3">
      <PageHeader title="Hôm nay ăn gì?" art="wheelFood" className="w-full" />

      {/*
        Controls beside the wheel once there is room, stacked below that.

        Everything used to be one centred column capped at max-w-md, so on a
        1440px screen the page was a narrow ribbon with two empty thirds either
        side — and the same stack is what pushed the wheel off the bottom when
        the window got short. Side by side spends the width that exists and
        halves the height the page needs.
      */}
      <div className="grid w-full items-center gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-10 short:gap-4">
      <div className="flex w-full flex-col gap-4 justify-self-center lg:justify-self-end">

      {/* Source tabs + helper */}
      <div className="flex w-full max-w-xs sm:max-w-md flex-col items-center gap-2 text-center lg:mx-0 lg:max-w-none lg:items-stretch lg:text-left lg:self-start">
        <Tabs tabs={SOURCE_TABS} value={source} onChange={setSource} className="w-full" />
        <p className="text-muted-foreground text-xs sm:text-sm short:hidden">
          Chọn nguồn để quay: quán đã lưu hoặc công thức tự nấu.
        </p>
      </div>

      {/* Category filter — only for places */}
      {source === "place" && (
        <div className="flex w-full max-w-xs sm:max-w-md flex-col gap-1 lg:max-w-none">
          <label className="text-muted-foreground text-xs sm:text-sm font-medium">
            Lọc theo danh mục (chỉ cho Quán xá)
          </label>
          <Select
            aria-label="Lọc danh mục"
            value={category}
            onChange={setCategory}
            options={[
              { value: "", label: "Mọi danh mục" },
              ...CATEGORIES.map((c) => ({ value: c, label: c })),
            ]}
          />
        </div>
      )}

      {/* The left column is short — two tabs and, at most, one dropdown — while
          the wheel column next to it runs to 400px plus a button. On lg that
          left a slab of empty air below the filters. Hidden below lg where
          there is no room to spare, and dropped again when short regardless
          of width (the !-forced override wins over lg:block either way the
          two media queries happen to sort in the compiled CSS). */}
      <div className="short:!hidden relative hidden h-48 overflow-hidden rounded-2xl shadow-[0_12px_28px_rgba(59,50,42,0.16)] lg:block xl:h-56">
        {/* wheelFoodAlt, not wheelFood again — the header above already shows
            wheelFood, and this box sat directly below it showing the very same
            picture twice on one page before this. */}
        <ToneArt name="wheelFoodAlt" alt="" fill position="center 65%" sizes="352px" />
      </div>

      </div>

      <div className="flex flex-col items-center gap-6 short:gap-4">
      {/*
        Sized against both axes rather than width breakpoints. At 960x600 — a
        MacBook at 150% zoom — the md: rule gave it a flat 400px while only
        ~420px of height remained, so the wheel and its spin button fell off
        the bottom of the screen. min() picks whichever limit binds: the 400px
        cap, the width on a narrow phone, or the height when zoomed in.
      */}
      <div className="relative h-[min(400px,70vw,48vh)] w-[min(400px,70vw,48vh)]">
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
                className="absolute max-w-[72px] truncate text-center text-[10px] sm:max-w-[90px] sm:text-xs md:max-w-[120px] md:text-sm font-bold text-white"
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
        <div className="bg-card absolute top-1/2 left-1/2 z-10 flex h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full text-center shadow-md ring-4 ring-white">
          <span className="text-base sm:text-lg md:text-2xl leading-none font-semibold">
            {items.length}
          </span>
          <span className="text-muted-foreground text-[10px] md:text-xs">món</span>
        </div>
      </div>

      {/* Empty state with actionable CTA */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-muted-foreground text-sm">
            {source === "place"
              ? places.data && places.data.length > 0
                ? "Hiện không có quán nào trong danh mục này đang mở cửa. Thử đổi danh mục, ghim thêm chỗ muốn tới, hoặc qua tab Tự nấu nhé!"
                : 'Chưa có địa điểm "Muốn đi". Thêm vài chỗ ở Bản đồ trước nhé.'
              : "Chưa có công thức nào. Lưu vài món ở Bộ sưu tập trước nhé."}
          </p>
          {source === "place" && !(places.data && places.data.length > 0) && (
            <Link
              href="/map"
              className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium transition-colors"
            >
              Đi tới Bản đồ để thêm địa điểm
            </Link>
          )}
          {source === "recipe" && (
            <Link
              href="/library"
              className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium transition-colors"
            >
              Thêm công thức ở Bộ sưu tập
            </Link>
          )}
        </div>
      ) : (
        <Button onClick={spin} disabled={spinning} className="w-32 sm:w-40 touch-manipulation" style={{ minHeight: 44 }}>
          {spinning ? "Đang quay…" : "Quay!"}
        </Button>
      )}
      </div>
      </div>

      <Modal open={!!winner} onClose={() => setWinner(null)}>
        <ModalHeader title="Tụi mình đi…" onClose={() => setWinner(null)} />
        <ModalContent>
          {winner && (
            <div className="space-y-3 text-center">
              {/* giftReveal (a plane bursting out of a gift box) replaces the
                  🎉 glyph: the wheel just revealed a pick, and this is
                  literally a reveal picture instead of a generic celebration
                  emoji. Modal is size="lg" (max-w-lg = 512px, ModalContent
                  p-5 both sides) so even at the 360px viewport floor the
                  content box is ~288px — 220px leaves margin on every side. */}
              <div className="relative mx-auto w-full max-w-[220px]">
                <ToneArt name="giftReveal" alt="" sizes="220px" />
              </div>
              <p className="text-xl sm:text-2xl font-semibold">{winner.name}</p>
              {winner.mustTry && (
                <p className="text-muted-foreground flex items-center justify-center gap-1 text-sm">
                  <Utensils className="h-4 w-4" />
                  {source === "place"
                    ? `Món nên thử: ${winner.mustTry}`
                    : `Thời gian nấu: ${winner.mustTry}`}
                </p>
              )}
              <div className="flex flex-col gap-2 pt-4">
                {source === "place" ? (
                  <Button
                    // On the accent, not a rose/pink gradient. Every other primary action in
                    // the app is terracotta; this one shouted from a different palette
                    // and read as belonging to some other product.
                    className="w-full gap-2 shadow-md"
                    disabled={sendInvite.isPending}
                    onClick={() => handleSendCompanionInvite(winner.id, winner.name)}
                  >
                    {sendInvite.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation className="h-4 w-4" />}
                    Rủ người kia tới đây!
                  </Button>
                ) : (
                  <a
                    href="/library"
                    className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-medium transition-colors"
                  >
                    Xem công thức
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
