"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { Check, ChevronUp, ChevronDown, Pencil, Trash2, ImagePlus, MapPin, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { useCelebrate } from "@/components/ui/celebrate";
import type { Tag } from "@/lib/plan-meta";
import { colorsForTags } from "@/lib/plan-meta";

export type DayItem = {
  id: string;
  title: string;
  note: string | null;
  time: string | null;
  tags: string[];
  status: string;
  assigneeId: string | null;
  locationId: string | null;
};

export type Member = { id: string; name: string; image: string | null; avatarEmoji: string | null; avatarColor: string | null };

function Avatar({ member }: { member: Member }) {
  if (member.image) {
    // eslint-disable-next-line @next/next/no-img-element
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
    },
    onSettled: () => utils.calendar.monthSummary.invalidate(),
  });

  // Reordering is rarer and order-sensitive; let the server be source of truth
  // but only refetch the open day (not the whole month) on success.
  const move = trpc.planItem.move.useMutation({
    onSuccess: () => utils.calendar.dayDetail.invalidate({ date }),
  });

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
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-1">
          {assignee ? (
            <Avatar member={assignee} />
          ) : (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-[10px]">
              <Users className="h-3 w-3" /> Cả hai
            </span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <IconBtn label="Lên" onClick={() => move.mutate({ id: item.id, direction: "up" })}><ChevronUp className="h-4 w-4" /></IconBtn>
            <IconBtn label="Xuống" onClick={() => move.mutate({ id: item.id, direction: "down" })}><ChevronDown className="h-4 w-4" /></IconBtn>
            <IconBtn label="Lưu thành kỷ niệm" onClick={onSaveAsMemory}><ImagePlus className="h-4 w-4" /></IconBtn>
            <IconBtn label="Sửa" onClick={onEdit}><Pencil className="h-4 w-4" /></IconBtn>
            <IconBtn label="Xoá" onClick={() => remove.mutate({ id: item.id })} danger><Trash2 className="h-4 w-4" /></IconBtn>
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
