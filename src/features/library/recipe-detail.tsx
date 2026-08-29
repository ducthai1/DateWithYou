"use client";

import { useEffect } from "react";
import { Modal, ModalHeader, ModalContent } from "@/components/ui/modal";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";
import { Clock, Users } from "lucide-react";
import { PhotoView } from "react-photo-view";
import type { MediaListItem } from "./media-card";
import { useNowPlaying } from "./now-playing-dock";

export function RecipeDetail({
  item,
  onClose,
  onReopen,
}: {
  item: MediaListItem;
  onClose: () => void;
  /** Re-open this same recipe's modal — wired to the mini dock's "return". */
  onReopen: () => void;
}) {
  const r = item.recipe;
  const hasEmbed = !!item.url;
  const { start, setVisible } = useNowPlaying();

  /*
   * There is no separate "press play" gesture inside this modal (unlike the
   * grid cards — see media-card.tsx) because the modal itself already is the
   * recipe's full view: opening it is the only deliberate action a user takes
   * before seeing the embed, so it doubles as the "start" signal.
   *
   * Closing it is treated as "left full view", the modal equivalent of an
   * inline card scrolling off-screen — it is literally the only way this
   * recipe's player can leave view, since there is no scrollable inline
   * embed for recipes to begin with.
   */
  useEffect(() => {
    if (!hasEmbed) return;
    start({
      id: item.id,
      kind: item.kind,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl ?? r?.coverImage ?? null,
      providerLabel: PROVIDER_LABEL[(item.provider ?? "other") as EmbedProvider],
      onReturn: onReopen,
    });
    setVisible(item.id, true);
    return () => setVisible(item.id, false);
    // Re-running on every onReopen/start identity change would re-fire the
    // "start" signal for the same still-open modal; only the item actually
    // changing (a different recipe opened) should do that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, hasEmbed]);

  return (
    <Modal size="xl" open onClose={onClose}>
      <ModalHeader title={item.title} onClose={onClose} />
      <ModalContent className="space-y-4">
        {r?.coverImage && (
          <PhotoView src={r.coverImage}>
            <img src={r.coverImage} alt={item.title} className="aspect-video w-full cursor-zoom-in rounded-xl object-cover" />
          </PhotoView>
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
