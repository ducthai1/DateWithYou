"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { StaggerList } from "@/components/ui/stagger-list";
import { Disc3, Filter, X } from "lucide-react";
import { MediaForm, type MediaKind } from "./media-form";
import { MediaCard, type MediaListItem } from "./media-card";
import { RecipeDetail } from "./recipe-detail";
import { GamesPanel } from "./games-panel";
import { Select } from "@/components/ui/select";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";

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
  const [tagFilter, setTagFilter] = useState<string>("");
  const [providerFilter, setProviderFilter] = useState<string>("");

  const isGame = kind === "game";
  const list = trpc.media.list.useQuery({ kind });
  const allItems = (list.data ?? []) as MediaListItem[];
  
  const handleKindChange = (k: MediaKind) => {
    setKind(k);
    setTagFilter("");
    setProviderFilter("");
  };

  const allTags = Array.from(new Set(allItems.flatMap(it => it.tags))).sort();
  const allProviders = Array.from(new Set(allItems.map(it => it.provider).filter(Boolean))).sort() as EmbedProvider[];

  const items = allItems.filter(it => {
    if (tagFilter && !it.tags.includes(tagFilter)) return false;
    if (providerFilter && it.provider !== providerFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 px-4 pt-6 pb-6 md:px-[30px]">
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
        <Tabs tabs={TABS} value={kind} onChange={handleKindChange} className="min-w-max sm:min-w-0" />
      </div>
      {!isGame && !list.isLoading && allItems.length > 0 && (allTags.length > 0 || allProviders.length > 0) && (
        <div className="bg-card border-border flex flex-row flex-wrap items-center gap-2 rounded-xl border p-2 shadow-sm sm:gap-3 sm:justify-between animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground sm:px-2">
            <Filter className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Bộ lọc</span>
          </div>
          
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {allTags.length > 0 && (
              <div className="w-[160px] sm:w-[180px]">
                <Select
                  value={tagFilter}
                  onChange={setTagFilter}
                  placeholder="Nhãn"
                  options={[
                    { value: "", label: "Tất cả nhãn" },
                    ...allTags.map(t => ({ value: t, label: t }))
                  ]}
                  className="h-9"
                />
              </div>
            )}
            {allProviders.length > 0 && (
              <div className="w-[160px] sm:w-[180px]">
                <Select
                  value={providerFilter}
                  onChange={setProviderFilter}
                  placeholder="Nguồn"
                  options={[
                    { value: "", label: "Tất cả nguồn" },
                    ...allProviders.map(p => ({ value: p, label: PROVIDER_LABEL[p] || p }))
                  ]}
                  className="h-9"
                />
              </div>
            )}
            {(tagFilter || providerFilter) && (
              <Button
                variant="ghost"
                className="h-9 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => { setTagFilter(""); setProviderFilter(""); }}
              >
                <X className="mr-1 h-4 w-4" />
                Xoá
              </Button>
            )}
          </div>
        </div>
      )}

      {isGame ? (
        <GamesPanel />
      ) : list.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : allItems.length === 0 ? (
        <EmptyState
          icon="music"
          title="Bộ sưu tập trống"
          subtitle="Lưu link nhạc, video món ngon hoặc công thức đầu tiên nhé."
          action={{ label: "+ Thêm ngay", onClick: () => setAdding(true) }}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="music"
          title="Không tìm thấy"
          subtitle="Thử bỏ bớt bộ lọc xem sao nhé."
          action={{ label: "Xoá lọc", onClick: () => { setTagFilter(""); setProviderFilter(""); } }}
        />
      ) : (
        <StaggerList className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => (
            <MediaCard key={it.id} item={it} onOpen={() => setRecipe(it)} />
          ))}
        </StaggerList>
      )}

      {adding && (
        <Modal open onClose={() => setAdding(false)} className="max-w-lg">
          <ModalHeader title={`Thêm vào ${TABS.find((t) => t.key === kind)?.label}`} onClose={() => setAdding(false)} />
          <MediaForm kind={kind} onDone={() => setAdding(false)} onCancel={() => setAdding(false)} />
        </Modal>
      )}

      {recipe && <RecipeDetail item={recipe} onClose={() => setRecipe(null)} />}
    </div>
  );
}
