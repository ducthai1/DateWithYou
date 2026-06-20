"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal, ModalHeader, ModalContent, ModalFooter } from "@/components/ui/modal";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { Dices, ChevronDown, ChevronUp, Users, Sparkles } from "lucide-react";
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

export function GamesPanel() {
  const list = trpc.media.list.useQuery({ kind: "game" });
  const utils = trpc.useUtils();
  const remove = trpc.media.remove.useMutation({
    onSuccess: () => utils.media.list.invalidate(),
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

  if (games.length === 0) {
    return (
      <EmptyState
        icon="sparkles"
        title="Chưa có trò chơi nào"
        subtitle="Thêm các trò chơi vui nhộn để mở ra chơi cùng nhau lúc đi hẹn hò nhé!"
      />
    );
  }

  return (
    <>
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

      {/* Detail modal */}
      {selected && (
        <Modal open onClose={() => setSelected(null)} className="max-w-md">
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
            <ConfirmButton
              idle="Xoá"
              className="text-destructive"
              onConfirm={() => {
                remove.mutate({ id: selected.id });
                setSelected(null);
              }}
            />
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Đóng
            </Button>
          </ModalFooter>
        </Modal>
      )}
    </>
  );
}
