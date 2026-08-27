"use client";

import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  uploadToCloudinary,
  cloudinaryConfigured,
  type UploadedPhoto,
} from "@/lib/cloudinary-upload";
import { ImagePlus, Link2, X, ExternalLink, Play } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ModalContent, ModalFooter } from "@/components/ui/modal";
import { TagPicker } from "@/features/calendar/tag-picker";
import { parseEmbed, normalizeUrl, PROVIDER_LABEL, type ParsedEmbed } from "@/lib/embed";
import { PhotoView } from "react-photo-view";
import { useToast } from "@/components/ui/toast";


/** Try to extract valid URLs from a string (caption, pasted text, etc.) */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex) ?? [];
  // Also detect bare domains: youtube.com/…, tiktok.com/…, etc.
  const bareRegex = /(?:^|\s)((?:(?:www\.)?(?:youtube\.com|youtu\.be|tiktok\.com|vm\.tiktok\.com|open\.spotify\.com|instagram\.com))[^\s<>"{}|\\^`[\]]*)/gi;
  const bareMatches = [...text.matchAll(bareRegex)].map((m) => m[1].trim());
  const all = [...matches, ...bareMatches.map((b) => normalizeUrl(b))];
  // Deduplicate
  return [...new Set(all)].filter(Boolean);
}

export function MemoryForm({
  onDone,
  onCancel,
  initialTitle,
  initialDate,
  initialLocationId,
  initialMemory,
}: {
  onDone: () => void;
  onCancel: () => void;
  // Optional prefill — used when creating a memory from a planned itinerary item.
  initialTitle?: string;
  initialDate?: string; // YYYY-MM-DD
  initialLocationId?: string;
  initialMemory?: {
    id: string;
    title: string;
    caption: string | null;
    date: Date | string;
    photos: { url: string; publicId: string }[];
    embeds: { url: string }[];
    tags: string[];
  };
}) {
  const [title, setTitle] = useState(initialMemory?.title ?? initialTitle ?? "");
  const [caption, setCaption] = useState(initialMemory?.caption ?? "");
  const [date, setDate] = useState(() => {
    if (initialMemory?.date) return new Date(initialMemory.date).toISOString().slice(0, 10);
    if (initialDate) return initialDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>(initialMemory?.photos ?? []);
  const [tags, setTags] = useState<string[]>(initialMemory?.tags ?? []);
  const [embeds, setEmbeds] = useState<ParsedEmbed[]>(() => {
    if (initialMemory?.embeds) {
      return initialMemory.embeds.map((e) => parseEmbed(e.url));
    }
    return [];
  });
  const toast = useToast();
  const [linkInput, setLinkInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** Add a single URL to embeds if not already present. */
  const addUrl = useCallback((raw: string) => {
    const v = normalizeUrl(raw);
    if (!v) return;
    setEmbeds((prev) => {
      if (prev.some((e) => e.url === v)) return prev; // dedupe
      return [...prev, parseEmbed(v)];
    });
  }, []);

  /** Manually add the current link input. */
  function addLink() {
    const v = normalizeUrl(linkInput);
    if (!v) return;
    addUrl(v);
    setLinkInput("");
  }

  /** Auto-detect URLs when user pastes into the link input. */
  function onPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text/plain").trim();
    if (!pasted) return;
    // If the pasted text looks like a URL (or contains one), auto-add it.
    const urls = extractUrls(pasted);
    if (urls.length > 0) {
      e.preventDefault(); // Don't also put the text in the input
      urls.forEach(addUrl);
    }
    // If it doesn't look like a URL, let the default paste happen
    // so the user can still type/edit in the input.
  }

  const utils = trpc.useUtils();
  const onSuccess = () => {
    utils.memory.list.invalidate();
    // Memories surface on the unified calendar, so refresh it too.
    utils.calendar.dayDetail.invalidate();
    utils.calendar.monthSummary.invalidate();
    toast("Đã lưu kỷ niệm ✓", "success");
    onDone();
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onError = (err: any) => toast("Lưu thất bại: " + (err?.message || "Thử lại nhé"), "error");
  const create = trpc.memory.create.useMutation({ onSuccess, onError });
  const update = trpc.memory.update.useMutation({ onSuccess, onError });

  async function onFiles(files: FileList | null) {
    if (!files) return;
    setErr(null);
    setUploading(true);
    try {
      const slots = Math.max(0, 10 - photos.length);
      const picked = Array.from(files).slice(0, slots);
      const uploaded = await Promise.all(picked.map(uploadToCloudinary));
      setPhotos((p) => [...p, ...uploaded]);
    } catch {
      setErr("Upload ảnh thất bại. Kiểm tra cấu hình Cloudinary.");
    } finally {
      setUploading(false);
    }
  }

  /** Collect all embeds including: saved ones, pending link input, and URLs in caption. */
  function collectAllEmbeds(): { url: string }[] {
    const all = [...embeds];
    // Include pending link input if user forgot to press Enter
    const pending = normalizeUrl(linkInput);
    if (pending && !all.some((e) => e.url === pending)) {
      all.push(parseEmbed(pending));
    }
    // Auto-extract URLs from caption text
    const captionUrls = extractUrls(caption);
    for (const u of captionUrls) {
      if (!all.some((e) => e.url === u)) {
        all.push(parseEmbed(u));
      }
    }
    return all.map((e) => ({ url: e.url }));
  }

  return (
    <>
      <ModalContent className="space-y-5">
        <Input placeholder="Tiêu đề (vd: Lần đầu đi Đà Lạt)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea
        placeholder="Kể lại cảm xúc, chi tiết (tuỳ chọn)"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
      />
      <DatePicker value={date} onChange={setDate} />

      <div>
        <p className="text-muted-foreground mb-2.5 text-xs font-medium">Nhãn</p>
        <TagPicker value={tags} onChange={setTags} />
      </div>

      <div className="space-y-2.5">
        <div className="space-y-1.5">
          <div className="relative">
            <Link2 className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              aria-label="Dán link nhạc hoặc video"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              onPaste={onPaste}
              placeholder="Dán link YouTube / TikTok / Spotify / Instagram…"
              className="border-border bg-card h-11 w-full rounded-xl border pl-9 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-accent focus:ring-1 focus:ring-accent/20"
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLink())}
            />
          </div>
          <p className="text-muted-foreground text-xs px-1">
            Nhạc/video sẽ hiển thị &amp; phát ngay trong kỷ niệm.
          </p>
        </div>
        {embeds.length > 0 && (
          <div className="space-y-2.5">
            {embeds.map((e, i) => (
              <div
                key={i}
                className="border-border bg-card flex items-center gap-2.5 rounded-xl border p-2 transition-all"
              >
                {e.thumbnailUrl ? (
                   
                  <img
                    src={e.thumbnailUrl}
                    alt={PROVIDER_LABEL[e.provider]}
                    className="h-12 w-20 shrink-0 rounded-lg object-cover"
                  />
                ) : (
                  <span className="bg-accent-soft text-accent flex h-12 w-12 shrink-0 items-center justify-center rounded-lg">
                    {e.provider === "youtube" ? (
                      <Play className="h-5 w-5" />
                    ) : e.provider === "spotify" ? (
                      <span className="text-lg">♫</span>
                    ) : e.provider === "tiktok" ? (
                      <span className="text-xs font-bold">TT</span>
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">{PROVIDER_LABEL[e.provider]}</p>
                  <p className="text-muted-foreground truncate text-[11px]">{e.url}</p>
                </div>
                <button
                  type="button"
                  aria-label="Bỏ link"
                  onClick={() => setEmbeds((arr) => arr.filter((_, j) => j !== i))}
                  className="hover:bg-muted shrink-0 rounded-full p-1.5 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-muted-foreground text-xs font-medium ml-0.5">Thêm ảnh (tuỳ chọn) · tối đa 10</p>

      {cloudinaryConfigured ? (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 sm:p-6
            ${
              uploading || photos.length >= 10
                ? "cursor-not-allowed border-border/50 bg-muted/20 opacity-60"
                : "border-border hover:border-accent hover:bg-accent-soft/30 bg-card active:scale-[0.99]"
            }
          `}
        >
          <div className="rounded-full bg-accent-soft p-3 text-accent shadow-sm">
            <ImagePlus className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {uploading ? "Đang tải lên..." : "Chạm để tải ảnh lên"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {photos.length >= 10 ? "Đã đạt tối đa 10 ảnh" : "Hỗ trợ ảnh JPG, PNG. Tối đa 10 ảnh."}
            </p>
          </div>
          <input
            aria-label="Chọn ảnh từ máy"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            disabled={uploading || photos.length >= 10}
          />
        </label>
      ) : (
        <p className="text-muted-foreground text-xs">
          Thêm ảnh cần cấu hình <code>NEXT_PUBLIC_CLOUDINARY_*</code>.
        </p>
      )}
      {uploading && <p className="text-muted-foreground text-xs">Đang tải ảnh…</p>}
      {photos.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-muted-foreground text-xs">{photos.length} ảnh</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <PhotoView key={p.publicId} src={p.url}>
                <img src={p.url} alt="" className="h-16 w-16 cursor-zoom-in rounded-lg object-cover" />
              </PhotoView>
            ))}
          </div>
        </div>
      )}
      {err && <p className="text-destructive text-sm">{err}</p>}
      {create.error && (
        <p className="text-destructive text-sm">
          {create.error.message.includes("NO_SPACE") ||
          create.error.message.includes("FORBIDDEN")
            ? "Bạn chưa có không gian. Vào /onboarding để tạo trước nhé."
            : "Không lưu được, thử lại nhé."}
        </p>
      )}
      </ModalContent>

      <ModalFooter>
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Huỷ
        </Button>
          <Button
            className="flex-1"
            onClick={() => {
              if (initialMemory) {
                update.mutate({
                  id: initialMemory.id,
                  title,
                  caption: caption || undefined,
                  date: new Date(date),
                  photos,
                  embeds: collectAllEmbeds(),
                  tags,
                });
              } else {
                create.mutate({
                  title,
                  caption: caption || undefined,
                  date: new Date(date),
                  photos,
                  embeds: collectAllEmbeds(),
                  tags,
                  locationId: initialLocationId,
                });
              }
            }}
            disabled={!title || (create.isPending || update.isPending)}
          >
            {(create.isPending || update.isPending) ? "Đang lưu..." : "Lưu"}
          </Button>
      </ModalFooter>
    </>
  );
}

