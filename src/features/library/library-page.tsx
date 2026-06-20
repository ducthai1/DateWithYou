"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { Disc3 } from "lucide-react";
import { MediaForm, type MediaKind } from "./media-form";
import { MediaCard, type MediaListItem } from "./media-card";
import { RecipeDetail } from "./recipe-detail";
import { GamesPanel } from "./games-panel";

const TABS = [
  { key: "music", label: "Nhạc" },
  { key: "food_video", label: "Video nấu ăn" },
  { key: "recipe", label: "Công thức" },
  { key: "game", label: "Trò chơi" },
] as const;

export function LibraryPage() {
  const [kind, setKind] = useState<MediaKind>("music");
  const [adding, setAdding] = useState(false);
  const [recipe, setRecipe] = useState<MediaListItem | null>(null);

  const isGame = kind === "game";
  const list = trpc.media.list.useQuery({ kind });
  const items = (list.data ?? []) as MediaListItem[];

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pt-6 pb-28 md:pb-6 md:px-[30px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-h1 font-serif">Bộ sưu tập</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            Lưu những thứ hai bạn thích: công thức nấu ăn, video món ngon, trò chơi để chơi cùng nhau.
          </p>
        </div>
        <div className="flex gap-2 sm:shrink-0">
          <a
            href="/wheel"
            aria-label="Vòng quay chọn món"
            title="Vòng quay chọn món"
            className="border-border bg-card hover:bg-muted inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border shadow-sm"
          >
            <Disc3 className="h-5 w-5 text-accent" />
          </a>
          <Button className="flex-1 sm:flex-none" onClick={() => setAdding(true)}>+ Thêm</Button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        <Tabs tabs={TABS} value={kind} onChange={setKind} className="min-w-max sm:min-w-0" />
      </div>

      {isGame ? (
        <GamesPanel />
      ) : list.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="music"
          title="Bộ sưu tập trống"
          subtitle="Lưu link nhạc, video món ngon hoặc công thức đầu tiên nhé."
          action={{ label: "+ Thêm ngay", onClick: () => setAdding(true) }}
        />
      ) : (
        <StaggerList className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <MediaCard key={it.id} item={it} onOpen={() => setRecipe(it)} />
          ))}
        </StaggerList>
      )}

      {adding && (
        <Modal open onClose={() => setAdding(false)} className="max-w-md">
          <ModalHeader title={`Thêm vào ${TABS.find((t) => t.key === kind)?.label}`} onClose={() => setAdding(false)} />
          <MediaForm kind={kind} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {recipe && <RecipeDetail item={recipe} onClose={() => setRecipe(null)} />}
    </div>
  );
}
