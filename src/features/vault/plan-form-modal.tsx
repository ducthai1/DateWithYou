"use client";

import { useState } from "react";
import { Lightbulb, MapPin, PenLine, Plus, RefreshCw, Target } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import {
  PLAN_CATEGORIES,
  guessPlanCategory,
  pickIdeas,
  planFromPlace,
  sameTitle,
  type PlanCategory,
} from "@/lib/plan-ideas";
import { foldForSearch } from "@/lib/vietnamese-text";
import { cn } from "@/lib/utils";
import { PLAN_COLUMNS, planCategoryIcon, type PlanStatus } from "./plan-board-meta";

export type PlanDraft = {
  id?: string;
  title: string;
  description: string;
  category: string;
  status: PlanStatus;
};

const isPreset = (c: string): c is PlanCategory => (PLAN_CATEGORIES as readonly string[]).includes(c);
const PLACES_SHOWN = 3;
const LABEL = "text-muted-foreground mb-2 block text-xs font-medium";

/**
 * Adding or editing one plan, with as little typing as possible.
 *
 * Everything but the title is a tap: the kind is a chip (guessed from the
 * title until someone picks one), the column is a chip, the note stays folded
 * away until asked for. And for a new plan the title can be a tap too — a place
 * they saved as "Muốn đi", or an idea of the kind they picked.
 */
export function PlanFormModal({
  open,
  draft,
  boardTitles,
  usedCategories,
  onClose,
  onSaved,
}: {
  /** Kept mounted while closed so the dialog can animate out; the board remounts it per opening. */
  open: boolean;
  draft: PlanDraft;
  boardTitles: string[];
  usedCategories: string[];
  onClose: () => void;
  onSaved: (movedToDone: boolean) => void;
}) {
  const editing = !!draft.id;
  // Kinds typed before the fixed list existed, the card's own first so it always has a chip.
  const extraKinds = [...new Set([draft.category, ...usedCategories])]
    .filter((c) => c && !isPreset(c))
    .slice(0, 4);
  const [title, setTitle] = useState(draft.title);
  const [category, setCategory] = useState(draft.category);
  // Once someone picks a kind, or opens a card that has one, stop guessing over it.
  const [categoryChosen, setCategoryChosen] = useState(editing);
  const [otherOpen, setOtherOpen] = useState(false);
  const [description, setDescription] = useState(draft.description);
  const [noteOpen, setNoteOpen] = useState(!!draft.description);
  const [status, setStatus] = useState<PlanStatus>(draft.status);
  const [turn, setTurn] = useState(0);

  const toast = useToast();
  const utils = trpc.useUtils();
  const done = () => {
    void utils.plan.list.invalidate();
    onSaved(status === "done" && draft.status !== "done");
  };
  const create = trpc.plan.create.useMutation({
    onSuccess: () => { toast("Đã thêm dự định mới!", "success"); done(); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const update = trpc.plan.update.useMutation({
    onSuccess: () => { toast("Đã cập nhật dự định!", "success"); done(); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const pending = create.isPending || update.isPending;

  const wanted = trpc.location.list.useQuery({ status: "want_to_go" }, { enabled: open && !editing });

  function changeTitle(next: string) {
    setTitle(next);
    if (!categoryChosen) setCategory(guessPlanCategory(next) ?? "");
  }

  function chooseCategory(next: string) {
    setCategoryChosen(true);
    setCategory(category === next ? "" : next);
  }

  function applySuggestion(next: { title: string; category: string; description?: string }) {
    setTitle(next.title);
    setCategory(next.category);
    setCategoryChosen(true);
    if (next.description && !description.trim()) {
      setDescription(next.description);
      setNoteOpen(true);
    }
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    const data = { title, description, category, status };
    if (draft.id) update.mutate({ id: draft.id, ...data });
    else create.mutate(data);
  }

  // What to offer for the title: their own "Muốn đi" places first, then ideas.
  const typed = foldForSearch(title);
  const places = editing
    ? []
    : (wanted.data ?? [])
        .filter((p) => !boardTitles.some((t) => sameTitle(t, p.name)))
        .filter((p) => !typed || foldForSearch(p.name).includes(typed))
        .slice(0, PLACES_SHOWN);
  const ideaKind = category && isPreset(category) ? category : null;
  const ideas = editing ? [] : pickIdeas({ taken: boardTitles, category: ideaKind, typed: title, turn });
  const moreIdeas = !typed && pickIdeas({ taken: boardTitles, category: ideaKind, count: 100 }).length > ideas.length;

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={editing ? "Chỉnh sửa dự định" : "Thêm dự định mới"}
        description="Nơi muốn tới, việc muốn làm — chưa cần gắn ngày cụ thể."
        icon={<Target className="h-[18px] w-[18px]" />}
        onClose={onClose}
      />
      {/* The form sits between the dialog's flex column and its body, so it has to
          carry the column on — without these the body stops scrolling and a long
          form pushes the footer, and its save button, out of the dialog. */}
      <form onSubmit={save} data-plan-form className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <ModalContent className="space-y-5">
          <div>
            <label htmlFor="plan-title" className={LABEL}>Muốn cùng nhau làm gì?</label>
            <Input
              id="plan-title"
              autoFocus={!editing}
              maxLength={120}
              placeholder="Gõ, hoặc chọn một gợi ý bên dưới"
              value={title}
              onChange={(e) => changeTitle(e.target.value)}
            />
          </div>

          {(places.length > 0 || ideas.length > 0) && (
            <div data-plan-suggestions className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-muted-foreground text-xs font-medium">
                  {ideaKind ? `Gợi ý · ${ideaKind}` : "Gợi ý cho hai bạn"}
                </p>
                {moreIdeas && (
                  <button
                    type="button"
                    onClick={() => setTurn((t) => t + 1)}
                    className="text-accent-ink hover:bg-accent-soft -mr-2 inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 text-xs font-medium"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Ý khác
                  </button>
                )}
              </div>
              {/* Two rows that scroll sideways on a phone: nine chips wrapped took six
                  rows and pushed the kind, the status and the save button off screen. */}
              <div className="relative -mx-5">
              <div className="grid auto-cols-max grid-flow-col grid-rows-2 justify-items-start gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] md:flex md:flex-wrap md:overflow-visible">
                {places.map((p) => (
                  <Chip
                    key={p.id}
                    icon={MapPin}
                    label={<span className="max-w-[11rem] truncate">{p.name}</span>}
                    selected={sameTitle(title, p.name)}
                    onClick={() => applySuggestion(planFromPlace(p))}
                    className="max-w-full"
                  />
                ))}
                {ideas.map((i) => (
                  <Chip
                    key={i.title}
                    icon={planCategoryIcon(i.category) ?? Lightbulb}
                    label={i.title}
                    selected={sameTitle(title, i.title)}
                    onClick={() => applySuggestion(i)}
                  />
                ))}
              </div>
              <div aria-hidden="true" className="from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden" />
              </div>
              {places.length > 0 && (
                <p className="text-muted-foreground text-[11px]">
                  <MapPin className="mr-0.5 inline h-3 w-3 align-[-2px]" aria-hidden="true" />
                  là chỗ hai bạn đã lưu “Muốn đi”.
                </p>
              )}
            </div>
          )}

          <div>
            <span className={LABEL}>Loại</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Loại dự định">
              {PLAN_CATEGORIES.map((c) => (
                <Chip key={c} label={c} selected={category === c} onClick={() => chooseCategory(c)} className="px-3" />
              ))}
              {extraKinds.map((c) => (
                <Chip key={c} label={<span className="max-w-[12rem] truncate">{c}</span>} selected={category === c} onClick={() => chooseCategory(c)} className="px-3" />
              ))}
              <Chip
                icon={PenLine}
                label="Khác"
                className="px-3"
                selected={otherOpen}
                onClick={() => {
                  setOtherOpen((o) => !o);
                  if (otherOpen && !isPreset(category) && !extraKinds.includes(category)) setCategory("");
                }}
              />
            </div>
            {otherOpen && (
              <div className="mt-2">
                <Input
                  aria-label="Loại khác"
                  maxLength={40}
                  placeholder="Tên loại, vd: Thể thao"
                  value={isPreset(category) || extraKinds.includes(category) ? "" : category}
                  onChange={(e) => {
                    setCategoryChosen(true);
                    setCategory(e.target.value);
                  }}
                />
              </div>
            )}
          </div>

          <div>
            <span className={LABEL}>Trạng thái</span>
            <div className="bg-muted flex h-11 items-center rounded-xl p-1 text-sm" role="group" aria-label="Trạng thái">
              {PLAN_COLUMNS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={status === c.key}
                  onClick={() => setStatus(c.key)}
                  className={cn(
                    "h-full min-w-0 flex-1 rounded-lg px-1 text-[13px] whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    status === c.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {c.short}
                </button>
              ))}
            </div>
          </div>

          {noteOpen ? (
            <div>
              <label htmlFor="plan-note" className={LABEL}>Ghi chú</label>
              <Textarea
                id="plan-note"
                rows={3}
                maxLength={1000}
                placeholder="Ngân sách, rủ thêm ai, cần chuẩn bị gì…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="text-muted-foreground hover:text-accent-ink -ml-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-1 text-sm font-medium"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Thêm ghi chú
            </button>
          )}
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={!title.trim() || pending}>
            {editing ? "Cập nhật" : "Thêm vào kế hoạch"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
