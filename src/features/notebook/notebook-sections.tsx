"use client";

import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { ScrollStrip } from "@/components/ui/scroll-strip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { Modal, ModalContent, ModalFooter, ModalHeader } from "@/components/ui/modal";
import { useQueryString } from "@/hooks/use-query-state";
import { NOTEBOOK_LIMITS } from "@/lib/notebook";
import type { NotebookActions, NotebookView } from "./use-notebook-actions";

type Editing = { key?: string; title: string; body: string };

/**
 * The notebook's free text — notes, milestones, a shopping list — as tabs,
 * because each is read on its own and the plan above already takes the height.
 * The open tab is `?muc=` so a reload keeps it.
 */
export function NotebookSections({ book, actions }: { book: NotebookView; actions: NotebookActions }) {
  const [param, setParam] = useQueryString("muc");
  const [editing, setEditing] = useState<Editing | null>(null);
  const current = book.sections.find((s) => s.key === param) ?? book.sections[0];
  const full = book.sections.length >= NOTEBOOK_LIMITS.sections;

  return (
    <Card className="space-y-3 p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ScrollStrip className="min-w-0 flex-1">
          {book.sections.length > 0 && (
            <Tabs
              tabs={book.sections.map((s) => ({ key: s.key, label: s.title }))}
              value={current?.key ?? ""}
              onChange={(k) => setParam(k === book.sections[0]?.key ? "" : k)}
              className="w-max"
            />
          )}
        </ScrollStrip>
        {!full && (
          <Button variant="outline" size="icon" aria-label="Thêm mục ghi chú" onClick={() => setEditing({ title: "", body: "" })}>
            <Plus className="h-5 w-5" />
          </Button>
        )}
      </div>

      {current ? (
        <div className="space-y-2">
          {current.body.trim() ? (
            <p className="whitespace-pre-line leading-relaxed wrap-anywhere">{current.body}</p>
          ) : (
            <p className="text-muted-foreground italic">Mục này chưa có gì.</p>
          )}
          <Button variant="ghost" className="h-10 px-3" onClick={() => setEditing({ ...current })}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Sửa mục này
          </Button>
        </div>
      ) : (
        <p className="text-muted-foreground italic">Chưa có mục ghi chú nào.</p>
      )}

      {editing && (
        <SectionForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(v) =>
            actions.saveSection.mutate(
              { id: book.id, ...v },
              { onSuccess: (r) => setParam(r.key === book.sections[0]?.key ? "" : r.key) },
            )
          }
          onRemove={
            editing.key && book.sections.length > 1
              ? () => {
                  actions.removeSection.mutate({ id: book.id, key: editing.key! });
                  setParam("");
                }
              : undefined
          }
        />
      )}
    </Card>
  );
}

function SectionForm({
  initial,
  onSave,
  onRemove,
  onClose,
}: {
  initial: Editing;
  onSave: (v: Editing) => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const canSave = title.trim() !== "";

  return (
    <Modal open onClose={onClose} className="max-w-lg">
      <ModalHeader title={initial.key ? "Sửa mục" : "Mục mới"} onClose={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!canSave) return;
          onSave({ key: initial.key, title: title.trim(), body });
          onClose();
        }}
      >
        <ModalContent className="space-y-3">
          <Input
            label="Tên mục"
            value={title}
            maxLength={NOTEBOOK_LIMITS.sectionTitle}
            placeholder="Vd: Đi chợ, Mốc tuần"
            autoFocus={!initial.key}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            aria-label="Nội dung"
            value={body}
            maxLength={NOTEBOOK_LIMITS.sectionBody}
            rows={10}
            placeholder={"Mỗi dòng một ý, vd:\nỨc gà 850g\nTôm 500g"}
            onChange={(e) => setBody(e.target.value)}
          />
        </ModalContent>
        <ModalFooter className="flex-wrap">
          {onRemove && (
            <ConfirmButton
              idle="Xoá mục"
              className="mr-auto"
              onConfirm={() => {
                onRemove();
                onClose();
              }}
            />
          )}
          <Button type="button" variant="ghost" onClick={onClose}>
            Không
          </Button>
          <Button type="submit" disabled={!canSave}>
            Lưu
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
