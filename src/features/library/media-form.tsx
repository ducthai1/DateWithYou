"use client";

import { useEffect, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { TagPicker } from "@/features/calendar/tag-picker";
import { useToast } from "@/components/ui/toast";
import { normalizeUrl, parseEmbed } from "@/lib/embed";
import { UploadFromDevice, VIDEO_SIZE_HINT } from "@/components/ui/upload-from-device";

export type MediaKind = "music" | "food_video" | "recipe" | "game";

export function MediaForm({
  kind,
  initialData,
  onDone,
  onCancel,
}: {
  kind: MediaKind;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  /*
   * The title comes from the link when there is one to read it from.
   *
   * Until someone types a title themselves: from then on the link is theirs to
   * change without their words being replaced. A ref, not state, because the
   * answer lands after a round trip and must see a title typed meanwhile.
   */
  const titleTyped = useRef(!!initialData?.title);
  const [lookingUp, setLookingUp] = useState(false);
  useEffect(() => {
    const link = normalizeUrl(url);
    if (titleTyped.current || !link) return;
    const provider = parseEmbed(link).provider;
    if (provider !== "youtube" && provider !== "spotify" && provider !== "tiktok") return;
    let live = true;
    const timer = setTimeout(() => {
      setLookingUp(true);
      utils.media.linkTitle
        .fetch({ url: link })
        .then((r) => {
          if (live && r.title && !titleTyped.current) setTitle(r.title);
        })
        .catch(() => {})
        .finally(() => live && setLookingUp(false));
    }, 400);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [url, utils]);

  function typeTitle(next: string) {
    titleTyped.current = next.trim() !== "";
    setTitle(next);
  }
  const create = trpc.media.create.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      toast("Đã thêm vào bộ sưu tập", "success");
      onDone();
    },
    onError: (err) => toast(readableFormError(err.message), "error")
  });
  const update = trpc.media.update.useMutation({
    onSuccess: () => {
      utils.media.list.invalidate();
      toast("Đã cập nhật", "success");
      onDone();
    },
    onError: (err) => toast(readableFormError(err.message), "error")
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
        {/* Link first where there is one: pasting it fills the name below. */}
        {!isRecipe && !isGame && (
          /* Dán link HOẶC tải từ máy — trước đây chỉ có nửa đầu, nên một clip
             tự quay phải đem lên YouTube trước mới lưu được vào đây. */
          <div className="space-y-1.5">
            <Input
              aria-label="Link"
              inputMode="url"
              autoFocus={!initialData?.id}
              placeholder="Dán link YouTube / Spotify / TikTok"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
            <div className="flex items-center gap-2">
              <UploadFromDevice
                accept="video/*"
                label="Tải video từ máy"
                onUploaded={setUrl}
              />
              <span className="text-muted-foreground text-[11px]">{VIDEO_SIZE_HINT}</span>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Input
            aria-label="Tên"
            placeholder={isGame ? "Tên trò chơi" : isRecipe ? "Tên món" : "Tên — tự điền khi dán link"}
            value={title}
            onChange={(e) => typeTitle(e.target.value)}
          />
          {lookingUp && !title && (
            <p className="text-muted-foreground px-1 text-[11px]" role="status">Đang lấy tên từ link…</p>
          )}
        </div>
        {isRecipe && (
          <>
            <div className="space-y-1.5">
              <Input placeholder="Link ảnh bìa (https)" value={cover} onChange={(e) => setCover(e.target.value)} />
              <UploadFromDevice accept="image/*" label="Tải ảnh bìa từ máy" onUploaded={setCover} />
            </div>
            <div className="space-y-1.5">
              <Input placeholder="Link video hướng dẫn (tuỳ chọn)" value={url} onChange={(e) => setUrl(e.target.value)} />
              <div className="flex items-center gap-2">
                <UploadFromDevice
                  accept="video/*"
                  label="Tải video từ máy"
                  onUploaded={setUrl}
                />
                <span className="text-muted-foreground text-[11px]">{VIDEO_SIZE_HINT}</span>
              </div>
            </div>
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
        <Button variant="secondary" className="flex-1" onClick={onCancel}>Huỷ</Button>
        <Button className="flex-1" disabled={!title.trim() || isPending} onClick={submit}>
          {isPending ? "Đang lưu…" : "Lưu"}
        </Button>
      </ModalFooter>
    </>
  );
}
