"use client";

import { useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";
import { Clock, Users, ChefHat, Edit, Play } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { MediaForm } from "./media-form";
import { useNowPlaying, type NowPlayingItem } from "./now-playing-context";
import { cn } from "@/lib/utils";

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

/** Maps a list row onto what the floating player needs. Null for rows with no
 *  link — recipes and games never reach the player. */
export function toNowPlayingItem(item: MediaListItem): NowPlayingItem | null {
  if (!item.url) return null;
  const provider = (item.provider ?? "other") as EmbedProvider;
  return {
    id: item.id,
    kind: item.kind,
    title: item.title,
    thumbnailUrl: item.thumbnailUrl,
    providerLabel: PROVIDER_LABEL[provider],
    embed: {
      provider,
      url: item.url,
      embedUrl: item.embedUrl,
      thumbnailUrl: item.thumbnailUrl,
      title: item.title,
    },
  };
}

export function MediaCard({
  item,
  onOpen,
  queue,
}: {
  item: MediaListItem;
  onOpen?: () => void;
  /** The list this card sits in, so the player can skip to the next track
   *  without the library page being mounted any more. */
  queue?: MediaListItem[];
}) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const { stop } = useNowPlaying();

  const remove = trpc.media.remove.useMutation({
    // The card goes now; the server hears about it after. Waiting a round trip
    // before a confirmed delete takes effect reads as a dead button.
    onMutate: async ({ id }) => {
      const key = { kind: item.kind } as const;
      await utils.media.list.cancel(key);
      const prev = utils.media.list.getData(key);
      utils.media.list.setData(key, (old) => old?.filter((m) => m.id !== id));
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.media.list.setData(ctx.key, ctx.prev);
      toast(readableFormError(err.message), "error");
    },
    onSuccess: () => {
      toast("Đã xoá mục khỏi bộ sưu tập", "success");
      // No-ops unless this item was the one tracked as "now playing" — deleting
      // it must not leave the mini dock pointing at something that no longer
      // exists.
      stop(item.id);
    },
    onSettled: () => utils.media.list.invalidate(),
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
        item.url && <PlayableEmbed item={item} queue={queue} />
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

/**
 * Gates the embed behind a poster + play button instead of mounting the
 * iframe immediately.
 *
 * This is the only reliable "the user pressed play" signal this app can
 * produce (see now-playing-dock.tsx for why: the iframe is cross-origin, so
 * there is no way to observe activity inside it once mounted). Before this
 * gate existed, every card with a URL rendered its iframe unconditionally,
 * which meant nothing ever counted as "the one playing" — every visible card
 * looked equally active.
 */
function PlayableEmbed({ item, queue }: { item: MediaListItem; queue?: MediaListItem[] }) {
  const { playing, start } = useNowPlaying();
  const isPlaying = playing?.id === item.id;

  /*
   * Hands the frame to the dock instead of mounting one here.
   *
   * The iframe used to live in this card, so walking to another tab unmounted
   * it and the music stopped — and an iframe cannot be moved to a new parent
   * without reloading, so there was no fix that kept it here. The card now says
   * what to play and shows that it is playing; the dock above the router owns
   * the only frame and keeps it alive across the whole app.
   */
  const handleActivate = () => {
    /*
     * The whole visible list goes with it, not just this row. Skip buttons in
     * the player have to work from any screen, and by then this page is gone.
     */
    const list = (queue?.length ? queue : [item])
      .map(toNowPlayingItem)
      .filter((q): q is NowPlayingItem => q !== null);
    const at = list.findIndex((q) => q.id === item.id);
    start(list, at < 0 ? 0 : at);
  };

  return (
    <button
      type="button"
      onClick={handleActivate}
      aria-label={isPlaying ? `${item.title} đang phát` : `Phát ${item.title}`}
      className="group border-border bg-accent-soft focus-visible:ring-ring relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2"
    >
      {item.thumbnailUrl && (
        <img
          src={item.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <span
        className={cn(
          "relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm backdrop-blur-sm transition-colors",
          isPlaying
            ? "bg-accent text-accent-foreground"
            : "bg-card/90 text-foreground group-hover:bg-card",
        )}
      >
        <Play className="h-3.5 w-3.5" aria-hidden="true" />
        {isPlaying ? "Đang phát" : "Phát"}
      </span>
    </button>
  );
}
