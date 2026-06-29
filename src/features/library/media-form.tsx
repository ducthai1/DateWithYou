"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { TagPicker } from "@/features/calendar/tag-picker";
import { useToast } from "@/components/ui/toast";
import { normalizeUrl } from "@/lib/embed";

export type MediaKind = "music" | "food_video" | "recipe" | "game";

export function MediaForm({
  kind,
  initialData,
  onDone,
  onCancel,
}: {
  kind: MediaKind;
  initialData?: any;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [url, setUrl] = useState(initialData?.url ?? "");
  const [note, setNote] = useState(initialData?.note ?? "");
  const [tags, setTags] = useState<string[]>(initialData?.tags ?? []);
  // Recipe-only fields.
  const [ingredients, setIngredients] = useState(initialData?.recipe?.ingredients?.join("\n") ?? "");
  const [steps, setSteps] = useState(initialData?.recipe?.steps?.join("\n") ?? "");
  const [cookTime, setCookTime] = useState(initialData?.recipe?.cookTime ?? "");
  const [servings, setServings] = useState(initialData?.recipe?.servings ?? "");
  const [cover, setCover] = useState(initialData?.recipe?.coverImage ?? "");

  const toast = useToast();
  const utils = trpc.useUtils();
  const create = trpc.media.create.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      toast("Đã thêm vào bộ sưu tập", "success");
      onDone();
    },
    onError: (err) => toast(err.message, "error")
  });
  const update = trpc.media.update.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      toast("Đã cập nhật", "success");
      onDone();
    },
    onError: (err) => toast(err.message, "error")
  });

  const isRecipe = kind === "recipe";
  const isGame = kind === "game";
  const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

  function submit() {
    const payload = {
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
    };
    
    if (initialData?.id) {
      update.mutate({ id: initialData.id, ...payload });
    } else {
      create.mutate({ kind, ...payload });
    }
  }

  const isPending = create.isPending || update.isPending;
  const isError = create.isError || update.isError;

  return (
    <>
      <ModalContent className="space-y-5">
        <Input placeholder={isGame ? "Tên trò chơi" : "Tên"} value={title} onChange={(e) => setTitle(e.target.value)} />
        {!isRecipe && !isGame && (
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
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Input placeholder="Thời gian nấu (vd: 30 phút)" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
              <Input placeholder="Khẩu phần (vd: 2 người)" value={servings} onChange={(e) => setServings(e.target.value)} />
            </div>
            <Textarea placeholder="Nguyên liệu (mỗi dòng một thứ)" value={ingredients} onChange={(e) => setIngredients(e.target.value)} rows={4} />
            <Textarea placeholder="Các bước (mỗi dòng một bước)" value={steps} onChange={(e) => setSteps(e.target.value)} rows={5} />
          </>
        )}
        <Textarea
          placeholder={isGame ? "Luật chơi / cách chơi (mô tả chi tiết)" : "Ghi chú (tuỳ chọn)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={isGame ? 5 : 2}
        />
        <div>
          <p className="text-muted-foreground mb-2.5 text-xs font-medium ml-1">Nhãn</p>
          <TagPicker value={tags} onChange={setTags} />
        </div>
      </ModalContent>
      {isError && (
        <p className="text-destructive px-5 text-sm">
          Lưu không được — kiểm tra lại link nhé.
        </p>
      )}
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>Huỷ</Button>
        <Button disabled={!title.trim() || isPending} onClick={submit}>
          {isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </ModalFooter>
    </>
  );
}
