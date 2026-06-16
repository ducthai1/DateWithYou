"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { TagPicker } from "@/features/calendar/tag-picker";
import { normalizeUrl } from "@/lib/embed";

export type MediaKind = "music" | "food_video" | "recipe";

export function MediaForm({
  kind,
  onDone,
  onCancel,
}: {
  kind: MediaKind;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  // Recipe-only fields.
  const [ingredients, setIngredients] = useState("");
  const [steps, setSteps] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [cover, setCover] = useState("");

  const utils = trpc.useUtils();
  const create = trpc.media.create.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      onDone();
    },
  });

  const isRecipe = kind === "recipe";
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  function submit() {
    // Embed metadata is derived server-side from the URL — only send the URL.
    // Normalize so a pasted "youtube.com/…" (no scheme) isn't rejected.
    create.mutate({
      kind,
      title: title.trim(),
      note: note.trim() || undefined,
      url: normalizeUrl(url) || undefined,
      tags,
      recipe: isRecipe
        ? {
            ingredients: lines(ingredients),
            steps: lines(steps),
            cookTime: cookTime.trim() || undefined,
            servings: servings.trim() || undefined,
            coverImage: normalizeUrl(cover) || undefined,
          }
        : undefined,
    });
  }

  return (
    <>
      <ModalContent className="space-y-4">
        <Input placeholder="Tên" value={title} onChange={(e) => setTitle(e.target.value)} />
        {!isRecipe && (
          <Input
            placeholder="Link YouTube / Spotify / TikTok"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        {isRecipe && (
          <>
            <Input placeholder="Link ảnh bìa (https)" value={cover} onChange={(e) => setCover(e.target.value)} />
            <Input placeholder="Link video hướng dẫn (tuỳ chọn)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Thời gian nấu" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
              <Input placeholder="Khẩu phần" value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
            <Textarea placeholder="Nguyên liệu (mỗi dòng một thứ)" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} />
            <Textarea placeholder="Các bước (mỗi dòng một bước)" value={steps} onChange={(e) => setSteps(e.target.value)} rows={5} />
          </>
        )}
        <Textarea placeholder="Ghi chú (tuỳ chọn)" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        <div>
          <p className="text-muted-foreground mb-1.5 text-xs font-medium">Nhãn</p>
          <TagPicker value={tags} onChange={setTags} />
        </div>
      </ModalContent>
      {create.error && (
        <p className="text-destructive px-5 text-sm">
          Lưu không được — kiểm tra lại link nhé.
        </p>
      )}
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>Huỷ</Button>
        <Button disabled={!title.trim() || create.isPending} onClick={submit}>
          {create.isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </ModalFooter>
    </>
  );
}
