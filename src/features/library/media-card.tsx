"use client";

import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { type EmbedProvider } from "@/lib/embed";
import { Clock, Users, ChefHat } from "lucide-react";

export type MediaListItem = {
  id: string;
  kind: "music" | "food_video" | "recipe";
  title: string;
  note: string | null;
  url: string | null;
  provider: string | null;
  embedUrl: string | null;
  thumbnailUrl: string | null;
  tags: string[];
  recipe: {
    ingredients: string[];
    steps: string[];
    cookTime: string | null;
    servings: string | null;
    coverImage: string | null;
  } | null;
};

export function MediaCard({ item, onOpen }: { item: MediaListItem; onOpen?: () => void }) {
  const utils = trpc.useUtils();
  const remove = trpc.media.remove.useMutation({ onSuccess: () => utils.media.list.invalidate() });

  return (
    <Card className="space-y-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{item.title}</p>
        <ConfirmButton idle="" className="text-xs" onConfirm={() => remove.mutate({ id: item.id })} />
      </div>

      {item.kind === "recipe" ? (
        <button type="button" onClick={onOpen} className="block w-full text-left">
          {item.recipe?.coverImage && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.recipe.coverImage} alt={item.title} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
            </div>
          )}
          <div className="text-muted-foreground mt-1.5 flex flex-wrap items-center gap-3 text-xs">
            {item.recipe?.cookTime && <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{item.recipe.cookTime}</span>}
            {item.recipe?.servings && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{item.recipe.servings}</span>}
            <span className="text-accent inline-flex items-center gap-1 font-medium"><ChefHat className="h-3 w-3" />Xem công thức</span>
          </div>
        </button>
      ) : (
        item.url && (
          <EmbedPlayer
            data={{ provider: (item.provider ?? "other") as EmbedProvider, url: item.url, embedUrl: item.embedUrl, thumbnailUrl: item.thumbnailUrl, title: item.title }}
          />
        )
      )}

      {item.note && <p className="text-muted-foreground text-xs">{item.note}</p>}
      {item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {item.tags.map((t) => (
            <span key={t} className="bg-accent-soft text-accent rounded-full px-2 py-0.5 text-[10px] font-medium">{t}</span>
          ))}
        </div>
      )}
    </Card>
  );
}
