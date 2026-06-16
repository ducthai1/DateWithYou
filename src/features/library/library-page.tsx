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
  { key: "food_video", label: "Video món ngon" },
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
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 py-6 md:px-[30px]">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-serif">Bộ sưu tập</h1>
        <div className="flex gap-2">
          <a
            href="/wheel"
            aria-label="Hôm nay ăn gì?"
            title="Hôm nay ăn gì?"
            className="border-border bg-card hover:bg-muted inline-flex h-11 w-11 items-center justify-center rounded-xl border shadow-sm"
          >
            <Disc3 className="h-5 w-5 text-accent" />
          </a>
          <Button onClick={() => setAdding(true)}>+ Thêm</Button>
        </div>
      </div>

      <Tabs tabs={TABS} value={kind} onChange={setKind} />

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
