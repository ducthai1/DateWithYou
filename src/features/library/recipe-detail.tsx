"use client";

import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { type EmbedProvider } from "@/lib/embed";
import { Clock, Users } from "lucide-react";
import Zoom from "react-medium-image-zoom";
import type { MediaListItem } from "./media-card";

export function RecipeDetail({ item, onClose }: { item: MediaListItem; onClose: () => void }) {
  const r = item.recipe;
  return (
    <Modal open onClose={onClose} className="max-w-lg">
      <ModalHeader title={item.title} onClose={onClose} />
      <ModalContent className="space-y-4">
        {r?.coverImage && (
          <Zoom>
            <img src={r.coverImage} alt={item.title} className="aspect-video w-full rounded-xl object-cover" />
          </Zoom>
        )}
        <div className="text-muted-foreground flex flex-wrap gap-4 text-sm">
          {r?.cookTime && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" />{r.cookTime}</span>}
          {r?.servings && <span className="inline-flex items-center gap-1"><Users className="h-4 w-4" />{r.servings}</span>}
        </div>

        {item.url && (
          <EmbedPlayer data={{ provider: (item.provider ?? "other") as EmbedProvider, url: item.url, embedUrl: item.embedUrl, thumbnailUrl: item.thumbnailUrl, title: item.title }} />
        )}

        {r && r.ingredients.length > 0 && (
          <section>
            <h3 className="mb-1.5 font-semibold">Nguyên liệu</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-sm">
              {r.ingredients.map((ing, i) => <li key={i}>{ing}</li>)}
            </ul>
          </section>
        )}

        {r && r.steps.length > 0 && (
          <section>
            <h3 className="mb-1.5 font-semibold">Các bước</h3>
            <ol className="list-decimal space-y-1.5 pl-5 text-sm">
              {r.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </section>
        )}

        {item.note && <p className="text-muted-foreground text-sm">{item.note}</p>}
      </ModalContent>
    </Modal>
  );
}
