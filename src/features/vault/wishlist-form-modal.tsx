"use client";

import { useState } from "react";
import { Gift, Link as LinkIcon, Plus } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { normalizeUrl } from "@/lib/embed";
import { looksLikeLink, nameFromProductLink } from "@/lib/product-link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";

export type WishDraft = {
  id?: string;
  itemName: string;
  price: number | null;
  pointCost: number;
  forWhom: "me" | "partner";
  note: string;
  sourceUrl: string;
};

const PRICE_PRESETS = [100_000, 200_000, 500_000, 1_000_000, 2_000_000];
const POINT_PRESETS = [50, 100, 200, 500];
/** What a task is worth when the couple has none yet — the panel's own default. */
const DEFAULT_TASK_POINTS = 10;
const LABEL = "text-muted-foreground mb-2 block text-xs font-medium";

/**
 * Adding or editing a wish, with the numbers offered rather than invented.
 *
 * The price shows as "500.000 đ" and has round amounts to tap. The point
 * price — a number nobody had a feel for — has a few sizes and says what each
 * means in their own currency: how many of their tasks it takes. A shop link
 * pasted into the name box goes to the link field, and a Shopee link brings
 * the product's name with it.
 */
export function WishlistFormModal({
  open,
  draft,
  partnerName,
  onClose,
}: {
  open: boolean;
  draft: WishDraft;
  partnerName: string;
  onClose: () => void;
}) {
  const editing = !!draft.id;
  const [itemName, setItemName] = useState(draft.itemName);
  const [sourceUrl, setSourceUrl] = useState(draft.sourceUrl);
  const [price, setPrice] = useState<number | null>(draft.price);
  const [pointCost, setPointCost] = useState<number>(draft.pointCost);
  const [forWhom, setForWhom] = useState(draft.forWhom);
  const [note, setNote] = useState(draft.note);
  const [noteOpen, setNoteOpen] = useState(!!draft.note);
  const [linkMoved, setLinkMoved] = useState(false);
  // A point price set to something other than the chips opens with its own field showing.
  const [pointsOther, setPointsOther] = useState(draft.pointCost > 0 && !POINT_PRESETS.includes(draft.pointCost));

  const toast = useToast();
  const utils = trpc.useUtils();
  const done = () => {
    void utils.wishlist.list.invalidate();
    onClose();
  };
  const create = trpc.wishlist.create.useMutation({
    onSuccess: () => { toast("Đã lưu vào wishlist ✓", "success"); done(); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const update = trpc.wishlist.update.useMutation({
    onSuccess: () => { toast("Đã cập nhật wishlist ✓", "success"); done(); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const pending = create.isPending || update.isPending;

  // Their own tasks are the scale a point price is read against.
  const rewards = trpc.reward.overview.useQuery(undefined, { enabled: open });
  const tasks = rewards.data?.tasks ?? [];
  const perTask = tasks.length
    ? Math.max(1, Math.round(tasks.reduce((s, t) => s + t.points, 0) / tasks.length))
    : DEFAULT_TASK_POINTS;

  function changeLink(next: string) {
    setSourceUrl(next);
    const name = nameFromProductLink(next);
    if (name && !itemName.trim()) setItemName(name);
  }

  function changeName(next: string) {
    // A link pasted where the name goes: move it, and take the name from it if it has one.
    if (looksLikeLink(next)) {
      setSourceUrl(next.trim());
      setItemName(nameFromProductLink(next) ?? "");
      setLinkMoved(true);
      return;
    }
    setLinkMoved(false);
    setItemName(next);
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || pending) return;
    const link = normalizeUrl(sourceUrl);
    const data = {
      itemName,
      forWhom,
      note,
      pointCost,
      // An edit sends null to take a price or link away; a new wish just leaves them out.
      price: price ?? (editing ? null : undefined),
      sourceUrl: link || (editing ? null : undefined),
    };
    if (draft.id) update.mutate({ id: draft.id, ...data });
    else create.mutate(data);
  }

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader
        title={editing ? "Chỉnh sửa Wishlist" : "Thêm vào Wishlist"}
        description="Món muốn có, hoặc muốn tặng — dán link shop cũng được."
        icon={<Gift className="h-[18px] w-[18px]" />}
        onClose={onClose}
      />
      <form onSubmit={save} data-wish-form>
        <ModalContent className="space-y-5">
          <div>
            <label htmlFor="wish-name" className={LABEL}>Tên món quà</label>
            <Input
              id="wish-name"
              autoFocus={!editing}
              maxLength={120}
              placeholder="Gõ tên, hoặc dán link Shopee"
              value={itemName}
              onChange={(e) => changeName(e.target.value)}
            />
            {linkMoved && (
              <p className="text-muted-foreground mt-1.5 text-xs" role="status">
                Đã chuyển link xuống ô Link{itemName ? " và lấy tên từ link" : " — link này không kèm tên, gõ thêm tên nhé"}.
              </p>
            )}
          </div>

          <div>
            <span className={LABEL}>Dành cho ai?</span>
            <div className="bg-muted flex h-11 items-center rounded-xl p-1 text-sm" role="group" aria-label="Dành cho ai">
              {(["me", "partner"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  aria-pressed={forWhom === w}
                  onClick={() => setForWhom(w)}
                  className={cn(
                    "h-full min-w-0 flex-1 truncate rounded-lg px-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                    forWhom === w ? "bg-background font-medium shadow-sm" : "text-muted-foreground",
                  )}
                >
                  {w === "me" ? "Bạn" : partnerName}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={LABEL}>Giá dự kiến</span>
            <MoneyInput value={price} onChange={setPrice} presets={PRICE_PRESETS} ariaLabel="Giá dự kiến" placeholder="Chưa biết" />
          </div>

          <div>
            <span className={LABEL}>Đổi bằng điểm Phiếu bé ngoan</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Giá đổi điểm">
              <Chip label="Không" selected={pointCost === 0 && !pointsOther} onClick={() => { setPointCost(0); setPointsOther(false); }} className="px-3" />
              {POINT_PRESETS.map((p) => (
                <Chip key={p} label={`${p} điểm`} selected={pointCost === p && !pointsOther} onClick={() => { setPointCost(p); setPointsOther(false); }} className="px-3" />
              ))}
              <Chip label="Số khác" selected={pointsOther} onClick={() => setPointsOther((o) => !o)} className="px-3" />
            </div>
            {pointsOther && (
              <div className="mt-2 max-w-[12rem]">
                <Input
                  aria-label="Số điểm khác"
                  inputMode="numeric"
                  placeholder="vd: 150"
                  value={pointCost > 0 ? String(pointCost) : ""}
                  onChange={(e) => setPointCost(Math.min(100_000, Number(e.target.value.replace(/\D/g, "")) || 0))}
                  suffixIcon={<span className="text-muted-foreground text-sm" aria-hidden="true">điểm</span>}
                />
              </div>
            )}
            <p className="text-muted-foreground mt-2 text-xs" data-wish-points-hint>
              {pointCost > 0
                ? `≈ ${Math.max(1, Math.round(pointCost / perTask))} nhiệm vụ ${perTask} điểm thì đổi được.`
                : "Chỉ mua bằng tiền, không đổi bằng điểm."}
            </p>
          </div>

          <div>
            <label htmlFor="wish-link" className={LABEL}>Link sản phẩm (nếu có)</label>
            <Input
              id="wish-link"
              inputMode="url"
              placeholder="shopee.vn/…"
              value={sourceUrl}
              onChange={(e) => changeLink(e.target.value)}
              prefixIcon={<LinkIcon className="h-4 w-4" />}
            />
          </div>

          {noteOpen ? (
            <div>
              <label htmlFor="wish-note" className={LABEL}>Ghi chú</label>
              <Textarea
                id="wish-note"
                rows={2}
                maxLength={500}
                placeholder="Màu, size, mua ở đâu…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="text-muted-foreground hover:text-accent-ink -ml-1 inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-1 text-sm font-medium"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Thêm ghi chú (màu, size…)
            </button>
          )}
        </ModalContent>
        <ModalFooter>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>Huỷ</Button>
          <Button type="submit" variant="primary" className="flex-1" disabled={!itemName.trim() || pending}>
            {editing ? "Cập nhật" : "Lưu vào Wishlist"}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
