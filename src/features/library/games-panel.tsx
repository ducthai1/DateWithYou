"use client";

import { useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "@/components/ui/modal";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { Dices, ChevronDown, ChevronUp, Users, Sparkles, Gamepad2, Swords, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

/* ── Pastel card colours for variety ── */
const CARD_COLORS = [
  { bg: "from-amber-50 to-yellow-100", border: "border-amber-200", icon: "text-amber-600" },
  { bg: "from-pink-50 to-rose-100", border: "border-pink-200", icon: "text-pink-600" },
  { bg: "from-sky-50 to-blue-100", border: "border-sky-200", icon: "text-sky-600" },
  { bg: "from-emerald-50 to-green-100", border: "border-emerald-200", icon: "text-emerald-600" },
  { bg: "from-violet-50 to-purple-100", border: "border-violet-200", icon: "text-violet-600" },
  { bg: "from-orange-50 to-amber-100", border: "border-orange-200", icon: "text-orange-600" },
];

function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

type GameItem = {
  id: string;
  title: string;
  note: string | null;
  tags: string[];
};

import { useToast } from "@/components/ui/toast";

export function GamesPanel() {
  const toast = useToast();
  const list = trpc.media.list.useQuery({ kind: "game" });
  const utils = trpc.useUtils();
  const remove = trpc.media.remove.useMutation({
    // The row goes now; the server hears about it after. Waiting a round
    // trip before a confirmed delete takes effect reads as a dead button.
    onMutate: async ({ id }) => {
      const key = { kind: "game" } as const;
      await utils.media.list.cancel(key);
      const prev = utils.media.list.getData(key);
      utils.media.list.setData(key, (old) => old?.filter((m) => m.id !== id));
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.media.list.setData(ctx.key, ctx.prev);
      toast(readableFormError(err.message), "error");
    },
    onSuccess: () => toast("Đã xoá trò chơi", "success"),
    onSettled: () => utils.media.list.invalidate(),
  });

  const [selected, setSelected] = useState<GameItem | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const games = (list.data ?? []) as GameItem[];

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (list.isLoading) return <div className="h-40 animate-pulse rounded-xl bg-muted" />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Promotional Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-orange-500 p-6 text-white shadow-lg group">
        <div className="absolute -right-6 -top-6 opacity-20 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12 pointer-events-none">
          <Gamepad2 className="h-40 w-40 sm:h-48 sm:w-48" />
        </div>
        <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5 max-w-lg">
            <h2 className="text-xl font-bold sm:text-2xl flex items-center gap-2 drop-shadow-md">
              <Swords className="h-6 w-6 text-yellow-300 drop-shadow" />
              Classic Arena
            </h2>
            <p className="text-sm font-medium text-white/90 sm:text-base leading-relaxed drop-shadow-sm">
              Trải nghiệm đấu trường game kinh điển dành riêng cho 2 người. Rủ rê người kia vào so tài ngay xem ai mới là &quot;trùm&quot; thực sự!
            </p>
          </div>
          <a
            href="https://classic-arena.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 flex items-center gap-2 rounded-xl bg-white/20 px-6 py-3 text-sm font-bold backdrop-blur-md transition-all hover:bg-white/30 hover:scale-105 active:scale-95 border border-white/30 shadow-xl"
          >
            Chơi ngay
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>

      {games.length === 0 ? (
        <EmptyState
          icon="sparkles"
          // The other library tabs' own empty states carry scene art
          // (emptyBackpack); this tab's never had one. Tone-neutral sky beats
          // forcing a travel-desk scene onto a "no games yet" message.
          art="skyWordmark"
          title="Chưa có trò chơi nào"
          subtitle="Thêm trò chơi cho cả hai (vd: Nối từ, 20 câu hỏi, Ai hiểu nhau hơn…)"
        />
      ) : (
        <StaggerList className="grid gap-3 sm:grid-cols-2">
          {games.map((game) => {
            const color = CARD_COLORS[hashStr(game.title) % CARD_COLORS.length];
            const isExpanded = expanded.has(game.id);
            const hasNote = !!game.note?.trim();

            return (
              <Card
                key={game.id}
                className={cn(
                  "relative overflow-hidden border bg-gradient-to-br p-0 transition-all duration-300",
                  color.bg,
                  color.border,
                )}
              >
                {/* Decorative dice icon — hidden on mobile to avoid crowding title */}
                <div className="absolute -right-3 -top-3 hidden opacity-[0.08] sm:block">
                  <Dices className="h-20 w-20 rotate-12" />
                </div>

                <div className="relative p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/60 shadow-sm", color.icon)}>
                        <Dices className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-sm text-stone-800 line-clamp-2 sm:truncate">{game.title}</h3>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelected(game)}
                        className="text-[10px] font-medium text-stone-500 hover:text-stone-700 bg-white/50 rounded-full px-2 py-0.5 transition-colors"
                      >
                        Chi tiết
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  {game.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {game.tags.map((t) => (
                        <span key={t} className="rounded-full bg-white/50 px-2 py-0.5 text-[10px] font-medium text-stone-600">
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Expandable rules preview */}
                  {hasNote && (
                    <button
                      type="button"
                      onClick={() => toggle(game.id)}
                      className="mt-2 flex w-full items-center gap-1 text-[11px] font-medium text-stone-500 hover:text-stone-700 transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {isExpanded ? "Ẩn luật chơi" : "Xem luật chơi"}
                    </button>
                  )}
                  {isExpanded && hasNote && (
                    <div className="mt-2 rounded-lg bg-white/40 p-3 text-xs text-stone-700 leading-relaxed whitespace-pre-line backdrop-blur-sm">
                      {game.note}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </StaggerList>
      )}

      {/* Detail modal */}
      {selected && (
        <Modal size="xl" open onClose={() => setSelected(null)} className="max-w-lg">
          <ModalHeader title={selected.title} onClose={() => setSelected(null)} />
          <ModalContent className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Chơi cùng nhau</span>
              <Sparkles className="h-4 w-4 ml-auto text-amber-500" />
            </div>

            {selected.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <span key={t} className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-medium">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {selected.note && (
              <div className="rounded-xl bg-muted/50 p-4 text-sm text-stone-700 dark:text-stone-300 leading-relaxed whitespace-pre-line">
                {selected.note}
              </div>
            )}
          </ModalContent>
          <ModalFooter>
            <Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>
              Đóng
            </Button>
            <ConfirmButton
              idle="Xoá"
              className="text-destructive flex-1"
              onConfirm={() => {
                remove.mutate({ id: selected.id });
                setSelected(null);
              }}
            />
          </ModalFooter>
        </Modal>
      )}
    </div>
  );
}
