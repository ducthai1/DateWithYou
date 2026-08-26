"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { type EmbedProvider } from "@/lib/embed";
import { Clock, Users, ChefHat, Edit } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { MediaForm } from "./media-form";

export type MediaListItem = {
  id: string;
  kind: "music" | "food_video" | "recipe" | "game";
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
  const toast = useToast();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  
  const remove = trpc.media.remove.useMutation({ 
    onSuccess: () => { utils.media.list.invalidate(); toast("Đã xoá mục khỏi bộ sưu tập", "success"); },
    onError: (err) => toast(err.message, "error")
  });

  return (
    <>
      <Card className="space-y-2 p-3 relative group transition-all duration-300 hover:-translate-y-1 hover:shadow-elev-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium leading-snug min-w-0 flex-1 pr-14">{item.title}</p>
          <div className="shrink-0 absolute top-3 right-3 flex items-center gap-1 bg-card/80 backdrop-blur-sm rounded-lg">
            <button
              onClick={() => setEditing(true)}
              className="p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors"
              aria-label="Sửa"
            >
              <Edit className="h-4 w-4" />
            </button>
            <ConfirmButton idle="" className="text-xs" onConfirm={() => remove.mutate({ id: item.id })} />
          </div>
        </div>

        {item.kind === "recipe" ? (
          <button type="button" onClick={onOpen} className="block w-full text-left">
          {item.recipe?.coverImage && (
            <div className="relative aspect-video w-full overflow-hidden rounded-lg">
              { }
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
    
    <Modal open={editing} onClose={() => setEditing(false)}>
      <ModalHeader title="Chỉnh sửa" onClose={() => setEditing(false)} />
      <MediaForm
        kind={item.kind}
        initialData={item}
        onDone={() => setEditing(false)}
        onCancel={() => setEditing(false)}
      />
    </Modal>
    </>
  );
}
