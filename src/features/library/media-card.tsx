"use client";

import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { EmbedPlayer } from "@/components/ui/embed-player";
import { PROVIDER_LABEL, type EmbedProvider } from "@/lib/embed";
import { Clock, Users, ChefHat, Edit, Play } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Modal, ModalHeader } from "@/components/ui/modal";
import { MediaForm } from "./media-form";
import { useNowPlaying } from "./now-playing-dock";
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

export function MediaCard({ item, onOpen }: { item: MediaListItem; onOpen?: () => void }) {
  const toast = useToast();
  const utils = trpc.useUtils();
  const [editing, setEditing] = useState(false);
  const { stop } = useNowPlaying();

  const remove = trpc.media.remove.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      toast("Đã xoá mục khỏi bộ sưu tập", "success");
      // No-ops unless this item was the one tracked as "now playing" — deleting
      // it must not leave the mini dock pointing at something that no longer
      // exists.
      stop(item.id);
    },
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
        item.url && <PlayableEmbed item={item} url={item.url} />
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
function PlayableEmbed({ item, url }: { item: MediaListItem; url: string }) {
  const { playing, start, stop, setVisible } = useNowPlaying();
  const [activated, setActivated] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const isPlaying = playing?.id === item.id;

  const handleActivate = () => {
    setActivated(true);
    start({
      id: item.id,
      kind: item.kind,
      title: item.title,
      thumbnailUrl: item.thumbnailUrl,
      providerLabel: PROVIDER_LABEL[(item.provider ?? "other") as EmbedProvider],
      onReturn: () =>
        wrapperRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }),
    });
  };

  // Reports visibility once activated; the provider drops updates for any id
  // that isn't the current "now playing" item, so this never needs to check
  // `isPlaying` itself.
  useEffect(() => {
    if (!activated) return;
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(item.id, entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [activated, item.id, setVisible]);

  // Leaving the grid entirely (switch tabs, apply a filter that excludes this
  // item) really does kill the iframe, unlike a scroll — there is no player
  // left to return to, so this clears "now playing" instead of leaving the
  // dock pointed at a card that no longer exists.
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  useEffect(() => {
    return () => {
      if (isPlayingRef.current) stop(item.id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  return (
    <div ref={wrapperRef}>
      {activated ? (
        <EmbedPlayer
          data={{
            provider: (item.provider ?? "other") as EmbedProvider,
            url,
            embedUrl: item.embedUrl,
            thumbnailUrl: item.thumbnailUrl,
            title: item.title,
          }}
        />
      ) : (
        <button
          type="button"
          onClick={handleActivate}
          aria-label={`Phát ${item.title}`}
          className="group border-border bg-accent-soft relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {item.thumbnailUrl && (
            <>
              <img
                src={item.thumbnailUrl}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span aria-hidden="true" className="absolute inset-0 bg-black/20" />
            </>
          )}
          <span
            className={cn(
              "text-accent relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110",
              item.thumbnailUrl && "backdrop-blur-sm",
            )}
          >
            <Play className="h-5 w-5 translate-x-0.5" aria-hidden="true" fill="currentColor" />
          </span>
        </button>
      )}
      {isPlaying && (
        <span className="sr-only" role="status">
          Đang phát: {item.title}
        </span>
      )}
    </div>
  );
}
