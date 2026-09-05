"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Plus, Check, X, Pencil, Trash2, Loader2 } from "lucide-react";

/**
 * Add, rename and delete blog categories.
 *
 * A category's slug never changes — posts point at it — so editing touches only
 * the display name. Deleting is blocked by the server while any post still uses
 * the category, and that error is surfaced to the admin as-is.
 */
export function CategoryManager() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const q = trpc.blog.categories.useQuery(undefined, { retry: false });
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const invalidate = () => {
    utils.blog.categories.invalidate();
    utils.blog.adminList.invalidate();
  };
  const create = trpc.blog.categoryCreate.useMutation({
    onSuccess: () => { invalidate(); setNewName(""); toast("Đã thêm danh mục", "success"); },
    onError: () => toast("Không thêm được", "error"),
  });
  const update = trpc.blog.categoryUpdate.useMutation({
    onSuccess: () => { invalidate(); setEditing(null); toast("Đã đổi tên", "success"); },
    onError: () => toast("Không đổi được", "error"),
  });
  const remove = trpc.blog.categoryRemove.useMutation({
    onSuccess: () => { invalidate(); toast("Đã xoá danh mục", "success"); },
    onError: (e) => toast(e.message || "Không xoá được", "error"),
  });

  const cats = q.data ?? [];
  const inputCls = "border-border focus:border-accent bg-card rounded-lg border px-3 py-1.5 text-sm outline-none";

  return (
    <div className="space-y-2 pt-1">
      <div className="flex gap-2">
        <input
          aria-label="Tên danh mục mới"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newName.trim()) { e.preventDefault(); create.mutate({ name: newName.trim() }); }
          }}
          placeholder="Tên danh mục mới…"
          className={`${inputCls} w-full`}
        />
        <button
          type="button"
          onClick={() => newName.trim() && create.mutate({ name: newName.trim() })}
          disabled={create.isPending || !newName.trim()}
          className="bg-accent inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Thêm
        </button>
      </div>

      <ul className="divide-border divide-y">
        {cats.map((c) => (
          <li key={c.slug} className="flex items-center gap-2 py-2">
            {editing === c.slug ? (
              <>
                <input
                  aria-label={`Đổi tên ${c.name}`}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className={`${inputCls} flex-1`}
                  autoFocus
                />
                <button
                  type="button"
                  aria-label="Lưu tên"
                  onClick={() => editName.trim() && update.mutate({ slug: c.slug, name: editName.trim() })}
                  className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg text-emerald-600"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Huỷ"
                  onClick={() => setEditing(null)}
                  className="text-muted-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <span className="text-foreground flex-1 truncate text-sm">{c.name}</span>
                <code className="text-muted-foreground shrink-0 text-xs">{c.slug}</code>
                <button
                  type="button"
                  aria-label={`Đổi tên ${c.name}`}
                  onClick={() => { setEditing(c.slug); setEditName(c.name); }}
                  className="text-muted-foreground hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <ConfirmButton
                  idle=""
                  icon={<Trash2 className="h-4 w-4" />}
                  aria-label={`Xoá ${c.name}`}
                  title={`Xoá danh mục "${c.name}"?`}
                  description="Chỉ xoá được khi không còn bài nào thuộc danh mục này."
                  disabled={remove.isPending}
                  className="text-muted-foreground hover:bg-destructive-soft hover:text-destructive flex h-8 w-8 items-center justify-center rounded-lg"
                  onConfirm={() => remove.mutate({ slug: c.slug })}
                />
              </>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
