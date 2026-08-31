"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Check, ChevronUp, ChevronDown, Pencil, Trash2, ImagePlus, MapPin, Users, Plane } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { useCelebrate } from "@/components/ui/celebrate";
import { useToast } from "@/components/ui/toast";
import type { Tag, BucketKey } from "@/lib/plan-meta";
import { colorsForTags } from "@/lib/plan-meta";

export type DayItem = {
  bucket?: BucketKey;
  id: string;
  title: string;
  note: string | null;
  time: string | null;
  tags: string[];
  status: string;
  assigneeId: string | null;
  locationId: string | null;
  tripId?: string | null;
};

export type Member = { id: string; name: string; image: string | null; avatarEmoji: string | null; avatarColor: string | null };

function Avatar({ member }: { member: Member }) {
  if (member.image) {
     
    return <img src={member.image} alt={member.name} className="h-6 w-6 rounded-full object-cover" title={member.name} />;
  }
  return (
    <span
      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold text-white"
      style={{ backgroundColor: member.avatarColor ?? "#c2693f" }}
      title={member.name}
    >
      {member.avatarEmoji ?? member.name.charAt(0).toUpperCase()}
    </span>
  );
}

export function PlanItemCard({
  item,
  date,
  members,
  palette,
  locationName,
  onEdit,
  onSaveAsMemory,
}: {
  item: DayItem;
  date: string;
  members: Member[];
  palette: Tag[];
  locationName?: string;
  onEdit: () => void;
  onSaveAsMemory: () => void;
}) {
  const utils = trpc.useUtils();
  const celebrate = useCelebrate();
  const toast = useToast();
  // Ref on the card container so the burst anchors to the tapped item.
  const cardRef = useRef<HTMLDivElement>(null);

  // Optimistic check-off / delete: patch the cached day detail immediately so
  // the tap reflects with zero network wait, then reconcile. The old code
  // awaited the mutation AND a follow-up refetch (two remote round-trips)
  // before the UI moved — the main source of the "laggy tap" feel. monthSummary
  // (calendar badge counts) is refreshed in the background, off the hot path.
  const setStatus = trpc.planItem.setStatus.useMutation({
    onMutate: async ({ id, status }) => {
      await utils.calendar.dayDetail.cancel({ date });
      const prev = utils.calendar.dayDetail.getData({ date });
      utils.calendar.dayDetail.setData({ date }, (old) =>
        old
          ? { ...old, items: old.items.map((it) => (it.id === id ? { ...it, status } : it)) }
          : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.calendar.dayDetail.setData({ date }, ctx.prev);
      toast(_e.message, "error");
    },
    onSettled: () => utils.calendar.monthSummary.invalidate(),
  });

  const remove = trpc.planItem.remove.useMutation({
    onMutate: async ({ id }) => {
      await utils.calendar.dayDetail.cancel({ date });
      const prev = utils.calendar.dayDetail.getData({ date });
      utils.calendar.dayDetail.setData({ date }, (old) =>
        old ? { ...old, items: old.items.filter((it) => it.id !== id) } : old,
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) utils.calendar.dayDetail.setData({ date }, ctx.prev);
      toast(_e.message, "error");
    },
    onSuccess: () => toast("Đã xoá kế hoạch", "success"),
    onSettled: () => utils.calendar.monthSummary.invalidate(),
  });

  /*
   * Reordering moves the list NOW and tells the server afterwards.
   *
   * It used to await the mutation and then refetch the whole day before the
   * card budged, so every tap on an arrow cost two round trips of nothing
   * happening — and tapping again during that window fought the refetch.
   *
   * So: swap in the cache on the tap, and send the bucket's finished order once
   * the tapping stops. Sending the destination rather than each step is what
   * makes holding the button down safe; the flurry collapses into one write,
   * and the write says where the list ended up rather than replaying how it
   * got there.
   */
  const reorder = trpc.planItem.reorder.useMutation({
    onError: (err, _v, ctx) => {
      const c = ctx as { prev?: ReturnType<typeof utils.calendar.dayDetail.getData> } | undefined;
      if (c?.prev) utils.calendar.dayDetail.setData({ date }, c.prev);
      toast(err.message, "error");
    },
    onSettled: () => utils.calendar.monthSummary.invalidate(),
  });

  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /*
   * The order to send is recorded on the TAP, not read back when the request
   * goes out. Reading the cache at flush time looks equivalent and is not: any
   * other write that invalidates this day — deleting a photo, say — replaces
   * the cache with the server's copy first, and the flush then sends back the
   * order it was about to change. The packing list had exactly this bug and it
   * cost every tick in the burst.
   */
  const pendingOrder = useRef<{ bucket: BucketKey; ids: string[] } | null>(null);
  const beforeFlurry = useRef<ReturnType<typeof utils.calendar.dayDetail.getData>>(undefined);
  // A pending order must not die with the card — an unmount mid-flurry (the day
  // sheet closing right after the last tap) would otherwise drop the write.
  useEffect(() => () => { if (flushTimer.current) clearTimeout(flushTimer.current); }, []);

  const SETTLE_MS = 400;

  function nudge(direction: "up" | "down") {
    const prev = utils.calendar.dayDetail.getData({ date });
    if (!prev) return;
    if (!beforeFlurry.current) beforeFlurry.current = prev;

    const items = [...prev.items];
    const i = items.findIndex((it) => it.id === item.id);
    if (i === -1) return;
    const bucket = items[i].bucket;
    const j = direction === "up" ? i - 1 : i + 1;
    // Only within the bucket: the neighbour across a boundary belongs to a
    // different heading, and an arrow must never move an item under one.
    if (j < 0 || j >= items.length || items[j].bucket !== bucket) return;

    [items[i], items[j]] = [items[j], items[i]];
    // Keep `order` honest with the new positions, so anything that re-sorts
    // this cache agrees with what is on screen.
    let n = 0;
    for (const it of items) if (it.bucket === bucket) it.order = n++;
    utils.calendar.dayDetail.setData({ date }, { ...prev, items });
    pendingOrder.current = {
      bucket: bucket as BucketKey,
      ids: items.filter((it) => it.bucket === bucket).map((it) => it.id),
    };

    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      flushTimer.current = null;
      const wanted = pendingOrder.current;
      pendingOrder.current = null;
      const rollback = beforeFlurry.current;
      beforeFlurry.current = undefined;
      if (!wanted) return;
      reorder.mutate(
        { date, bucket: wanted.bucket, ids: wanted.ids },
        // Roll back to where the list stood BEFORE the flurry, not before the
        // last tap — a rejected write invalidates every swap in the burst.
        { onError: () => rollback && utils.calendar.dayDetail.setData({ date }, rollback) },
      );
    }, SETTLE_MS);
  }

  const done = item.status === "done";
  const assignee = members.find((m) => m.id === item.assigneeId);
  const tagColors = colorsForTags(item.tags, palette);

  return (
    <div ref={cardRef} className="bg-card border-border relative flex items-start gap-2.5 rounded-xl border p-2.5 shadow-sm">
      <motion.button
        type="button"
        whileTap={{ scale: 0.8 }}
        aria-label={done ? "Bỏ hoàn thành" : "Hoàn thành"}
        onClick={() => {
          const next = done ? "planned" : "done";
          // Celebrate only on completion, anchored to this card.
          if (next === "done") celebrate(cardRef.current);
          setStatus.mutate({ id: item.id, status: next });
        }}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          done ? "bg-success border-success text-white" : "border-muted-foreground/40",
        )}
      >
        {done && <Check className="h-3 w-3" />}
      </motion.button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.time && <span className="text-accent text-xs font-semibold tabular-nums">{item.time}</span>}
          <p className={cn("truncate text-sm font-medium", done && "text-muted-foreground line-through")}>
            {item.title}
          </p>
        </div>
        {item.note && <p className="text-muted-foreground mt-0.5 text-xs">{item.note}</p>}

        {(item.tags.length > 0 || locationName) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {item.tags.map((t, i) => (
              <span
                key={t}
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                style={{ backgroundColor: tagColors[i] ?? "#9c8b7e" }}
              >
                {t}
              </span>
            ))}
            {locationName && (
              <span className="text-muted-foreground inline-flex items-center gap-0.5 text-[10px]">
                <MapPin className="h-3 w-3" /> {locationName}
              </span>
            )}
            {item.tripId && (
              <span className="text-accent inline-flex items-center gap-0.5 text-[10px] font-medium" title="Nằm trong một chuyến đi dài ngày">
                <Plane className="h-3 w-3" />
              </span>
            )}
          </div>
        )}

        {/* On mobile: assignee and actions wrap to separate lines so 5 icons never
            compete with content in a 360px card. On sm+ they stay inline. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 sm:flex-nowrap">
          {assignee ? (
            <Avatar member={assignee} />
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px]">
              <Users className="h-3 w-3" /> Cả hai
            </span>
          )}
          <div className="flex items-center gap-0.5 sm:ml-auto">
            <IconBtn label="Lên" onClick={() => nudge("up")}><ChevronUp className="h-4 w-4" /></IconBtn>
            <IconBtn label="Xuống" onClick={() => nudge("down")}><ChevronDown className="h-4 w-4" /></IconBtn>
            <IconBtn label="Lưu thành kỷ niệm" onClick={onSaveAsMemory}><ImagePlus className="h-4 w-4" /></IconBtn>
            <IconBtn label="Sửa" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
            <ConfirmButton
              idle=""
              icon={<Trash2 className="h-4 w-4" />}
              aria-label="Xoá việc này"
              title="Xoá việc này?"
              description={`"${item.title}" sẽ bị xoá khỏi ngày này. Không hoàn tác được.`}
              className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive active:bg-muted -m-1 flex h-9 w-9 items-center justify-center rounded-lg p-2.5 transition-colors touch-manipulation"
              onConfirm={() => remove.mutate({ id: item.id })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg p-2.5 -m-1 transition-colors touch-manipulation active:bg-muted",
        danger ? "text-muted-foreground hover:bg-destructive-soft hover:text-destructive" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
