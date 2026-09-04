"use client";

import { useState, useMemo } from "react";
import { usePartnerName } from "@/features/space/use-partner";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StaggerList } from "@/components/ui/stagger-list";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { AlertModal } from "@/components/ui/alert-modal";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useCelebrate } from "@/components/ui/celebrate";
import { useToast } from "@/components/ui/toast";
import { Trash2, Check, Undo2, Plus, Gift, Link as LinkIcon, User, Users, Coins, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type FilterMode = "all" | "active" | "bought";

export function WishlistGrid() {
  const partnerName = usePartnerName();
  const [filter, setFilter] = useState<FilterMode>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  // Form State
  const [itemName, setItemName] = useState("");
  const [price, setPrice] = useState("");
  const [pointCost, setPointCost] = useState("");
  const [forWhom, setForWhom] = useState<"me" | "partner">("partner");
  const [note, setNote] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  const toast = useToast();
  const list = trpc.wishlist.list.useQuery();
  const utils = trpc.useUtils();
  const invalidate = () => utils.wishlist.list.invalidate();
  const create = trpc.wishlist.create.useMutation({
    onSuccess: () => { closeForm(); invalidate(); toast("Đã lưu vào wishlist ✓", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  const update = trpc.wishlist.update.useMutation({
    onSuccess: () => { closeForm(); invalidate(); toast("Đã cập nhật wishlist ✓", "success"); },
    onError: (err) => toast(readableFormError(err.message), "error"),
  });
  /*
   * The tick moves first; the server hears about it afterwards.
   *
   * This awaited the mutation and then refetched the list before the checkbox
   * changed — two round trips of nothing happening on every tap. Same shape as
   * the trip packing list.
   */
  const toggle = trpc.wishlist.toggleBought.useMutation({
    onMutate: async ({ id }) => {
      await utils.wishlist.list.cancel();
      const prev = utils.wishlist.list.getData();
      utils.wishlist.list.setData(undefined, (old) =>
        old?.map((w) => (w.id === id ? { ...w, bought: !w.bought } : w)),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.wishlist.list.setData(undefined, ctx.prev);
      toast(readableFormError(err.message), "error");
    },
    onSettled: () => invalidate(),
  });
  const remove = trpc.wishlist.remove.useMutation({
    // The row goes now. Waiting for a round trip before a confirmed delete
    // takes effect reads as the button not having worked.
    onMutate: async ({ id }) => {
      await utils.wishlist.list.cancel();
      const prev = utils.wishlist.list.getData();
      utils.wishlist.list.setData(undefined, (old) => old?.filter((w) => w.id !== id));
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) utils.wishlist.list.setData(undefined, ctx.prev);
      toast(readableFormError(err.message), "error");
    },
    onSuccess: () => toast("Đã xoá món quà khỏi danh sách", "success"),
    onSettled: () => invalidate(),
  });
  const redeem = trpc.wishlist.redeem.useMutation({
    onSuccess: () => {
      invalidate();
      toast("Đã đổi quà 🎁", "success");
      // the confetti will be triggered from the button click
    },
    onError: (err) => { setRedeemError(readableFormError(err.message)); toast(readableFormError(err.message), "error"); },
  });

  const celebrate = useCelebrate();

  // Stable ref via query data (structural sharing) — wrapped so the memos below
  // don't see a fresh `[]` every render when the list is empty.
  const items = useMemo(() => list.data ?? [], [list.data]);
  const boughtCount = useMemo(() => items.filter(i => i.bought).length, [items]);
  const progressPercent = items.length > 0 ? (boughtCount / items.length) * 100 : 0;

  const filteredItems = useMemo(() => items.filter(i => {
    if (filter === "active") return !i.bought;
    if (filter === "bought") return i.bought;
    return true;
  }), [items, filter]);

  function openNewForm() {
    setItemName("");
    setPrice("");
    setPointCost("");
    setForWhom("partner");
    setNote("");
    setSourceUrl("");
    setEditingId(null);
    setFormOpen(true);
  }

  function openEditForm(item: typeof items[number]) {
    setItemName(item.itemName);
    setPrice(item.price ? String(item.price) : "");
    setPointCost(item.pointCost ? String(item.pointCost) : "");
    setForWhom(item.forWhom);
    setNote(item.note ?? "");
    setSourceUrl(item.sourceUrl ?? "");
    setEditingId(item.id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setTimeout(() => {
      setItemName("");
      setPrice("");
      setPointCost("");
      setForWhom("partner");
      setNote("");
      setSourceUrl("");
      setEditingId(null);
    }, 200);
  }

  function saveForm() {
    if (!itemName.trim()) return;
    const data = {
      itemName,
      price: price ? Number(price) : undefined,
      pointCost: pointCost ? Number(pointCost) : undefined,
      forWhom,
      note,
      sourceUrl: sourceUrl || undefined,
    };
    if (editingId) {
      update.mutate({ id: editingId, ...data });
    } else {
      create.mutate(data);
    }
  }

  function handleToggle(id: string, currentlyBought: boolean, anchorEl?: HTMLElement | null) {
    toggle.mutate({ id });
    if (!currentlyBought) {
      celebrate(anchorEl);
    }
  }

  function handleRedeem(id: string, anchorEl?: HTMLElement | null) {
    redeem.mutate({ id }, {
      onSuccess: () => celebrate(anchorEl)
    });
  }


  /*
   * Guard the render on fetch state BEFORE falling through to the list.
   * `list.data ?? []` made an in-flight fetch indistinguishable from a genuinely
   * empty space, so every visit flashed an empty state over the couple's real
   * content - and a failed fetch showed the same thing permanently, reading as
   * "our data is gone" rather than "we are offline".
   */
  if (list.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} variant="card" className="h-52" />
        ))}
      </div>
    );
  }

  if (list.isError) {
    return (
      <div className="text-muted-foreground flex flex-col items-center gap-3 py-16 text-center text-sm">
        <p>Chưa tải được dữ liệu. Kiểm tra kết nối rồi thử lại nhé.</p>
        <Button variant="secondary" onClick={() => void list.refetch()} disabled={list.isRefetching}>
          {list.isRefetching ? "Đang tải…" : "Thử lại"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Progress */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">Tiến độ mua sắm</span>
            <span className="font-semibold">{boughtCount} / {items.length} món</span>
          </div>
          <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
            <div 
              className="bg-accent h-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <Button onClick={openNewForm} className="shrink-0 gap-1.5" variant="primary">
          <Plus className="h-4 w-4" /> Thêm món quà
        </Button>
      </div>

      {/* Filters — full width on mobile so buttons don't get squeezed */}
      {items.length > 0 && (
        <div className="bg-muted flex rounded-xl p-1 text-sm">
          <button
            onClick={() => setFilter("all")}
            className={cn("flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors outline-none", filter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            Tất cả
          </button>
          <button
            onClick={() => setFilter("active")}
            className={cn("flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors outline-none", filter === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            Chưa mua
          </button>
          <button
            onClick={() => setFilter("bought")}
            className={cn("flex-1 rounded-lg px-3 py-1.5 font-medium transition-colors outline-none", filter === "bought" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
          >
            Đã mua
          </button>
        </div>
      )}

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <EmptyState
          icon="gift"
          // This IS the whole tab when empty, so it gets the "lg" step (176px)
          // rather than the 112px default other spots on this page use for a
          // section nested among other content.
          spot="mailboxOpen2"
          spotSize="lg"
          title="Wishlist trống"
          subtitle={items.length === 0 ? "Thêm món quà muốn có — ghi giá, gắn link và lên kế hoạch mua cùng nhau." : "Không có món quà nào trong mục này."}
        />
      ) : (
        <StaggerList gap="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredItems.map((w) => (
            <Card 
              key={w.id} 
              interactive
              onClick={() => openEditForm(w)}
              className={cn(
                "group relative flex flex-col gap-3 p-4 transition-all duration-300",
                w.bought && "opacity-60 grayscale-[0.2]"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="bg-accent-soft text-accent flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <Gift className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className={cn("font-semibold leading-tight", w.bought && "line-through decoration-2")}>
                    {w.itemName}
                  </h4>
                  <div className="mt-1 flex items-center gap-2">
                    {w.price != null && (
                      <span className="text-accent font-medium text-sm">
                        {w.price.toLocaleString("vi-VN")}đ
                      </span>
                    )}
                    {w.pointCost > 0 && (
                      <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 gap-1 px-1.5 py-0 border-none shadow-sm">
                        <Coins className="h-3 w-3" />
                        {w.pointCost} điểm
                      </Badge>
                    )}
                    <Badge tone="neutral" className="gap-1 px-1.5 py-0">
                      {w.forWhom === "me" ? <User className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                      {w.forWhom === "me" ? "Bạn" : partnerName}
                    </Badge>
                  </div>
                </div>
              </div>

              {w.note && (
                <p className="text-muted-foreground mt-2 border-l-2 pl-2 text-xs italic">
                  &quot;{w.note}&quot;
                </p>
              )}

              <div className="mt-auto flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between" onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    className={cn(
                      "inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-all duration-200 touch-manipulation sm:w-auto",
                      w.bought
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                    )}
                    onClick={(e) => handleToggle(w.id, w.bought, (e.target as HTMLElement).closest('.group') as HTMLElement | null)}
                  >
                    {w.bought ? (
                      <><Undo2 className="h-3.5 w-3.5" /> Bỏ đánh dấu</>
                    ) : (
                      <><Check className="h-3.5 w-3.5" /> Đã mua</>
                    )}
                  </button>

                  {!w.bought && w.pointCost > 0 && (
                    <div className="flex flex-col gap-0.5 w-full sm:w-auto">
                      <button
                        className="inline-flex min-h-[40px] w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all duration-200 bg-amber-400 text-amber-950 hover:bg-amber-500 shadow-sm touch-manipulation sm:w-auto"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRedeem(w.id, (e.target as HTMLElement).closest('.group') as HTMLElement | null);
                        }}
                        disabled={redeem.isPending}
                      >
                        {redeem.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5" />}
                        Đổi quà
                      </button>
                      <span className="text-muted-foreground text-[10px] text-center">Dùng điểm từ Phiếu bé ngoan</span>
                    </div>
                  )}
                  {w.sourceUrl && (
                    <a
                      href={w.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-muted text-muted-foreground hover:text-foreground inline-flex min-h-[40px] w-full items-center justify-center rounded-lg px-3 py-2 transition-colors touch-manipulation sm:w-auto"
                      aria-label={`Mở link của ${w.itemName}`}
                      title="Mở link"
                    >
                      <LinkIcon className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                <ConfirmButton
                  idle=""
                  confirmText="Xoá"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-destructive-soft hover:text-destructive opacity-100 transition-opacity touch-manipulation sm:opacity-0 sm:group-hover:opacity-100"
                  onConfirm={() => remove.mutate({ id: w.id })}
                />
              </div>
              
              {/* Overlay for bought items */}
              {w.bought && (
                <div className="pointer-events-none absolute -right-2 -top-2 rotate-12 drop-shadow-md">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-5 w-5 stroke-[3]" />
                  </div>
                </div>
              )}
            </Card>
          ))}
        </StaggerList>
      )}

      {/* Modal Form */}
      <Modal open={formOpen} onClose={closeForm}>
        <ModalHeader title={editingId ? "Chỉnh sửa Wishlist" : "Thêm vào Wishlist"} onClose={closeForm} />
        <ModalContent className="space-y-4">
          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Tên món quà</label>
            <Input 
              autoFocus 
              placeholder="VD: Giày sneaker, Nước hoa..." 
              value={itemName} 
              onChange={(e) => setItemName(e.target.value)} 
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Giá dự kiến (VNĐ)</label>
              <Input 
                type="number"
                placeholder="VD: 500000" 
                value={price} 
                onChange={(e) => setPrice(e.target.value)} 
              />
            </div>
            <div>
              <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Giá đổi điểm (Phiếu bé ngoan)</label>
              <Input 
                type="number"
                placeholder="VD: 100" 
                value={pointCost} 
                onChange={(e) => setPointCost(e.target.value)} 
              />
            </div>
          </div>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Dành cho ai?</label>
              <div className="bg-muted flex h-11 items-center rounded-xl p-1 text-sm">
                <button
                  className={cn("flex-1 rounded-lg py-1.5 transition-colors outline-none", forWhom === "me" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
                  onClick={() => setForWhom("me")}
                >
                  Bạn
                </button>
                <button
                  className={cn("flex-1 rounded-lg py-1.5 transition-colors outline-none", forWhom === "partner" ? "bg-background shadow-sm font-medium" : "text-muted-foreground")}
                  onClick={() => setForWhom("partner")}
                >
                  {partnerName}
                </button>
              </div>
            </div>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Link tham khảo (bắt đầu bằng https://)</label>
            <Input 
              placeholder="https://shopee.vn/..." 
              value={sourceUrl} 
              onChange={(e) => setSourceUrl(e.target.value)} 
            />
          </div>

          <div>
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium">Ghi chú thêm</label>
            <Textarea
              rows={2}
              placeholder="Màu sắc, size, địa chỉ mua..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </ModalContent>
        <ModalFooter>
          <Button variant="secondary" className="flex-1" onClick={closeForm}>Huỷ</Button>
          <Button variant="primary" className="flex-1" disabled={!itemName.trim() || create.isPending || update.isPending} onClick={saveForm}>
            {editingId ? "Cập nhật" : "Lưu vào Wishlist"}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Redeem failure (e.g. not enough points) — replaces native alert() */}
      <AlertModal
        open={!!redeemError}
        onClose={() => setRedeemError(null)}
        tone="error"
        title="Không đổi được quà"
        message={redeemError ?? ""}
      />
    </div>
  );
}
