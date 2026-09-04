"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readableFormError } from "@/lib/form-error";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TEXTAREA_CLASS } from "@/components/ui/textarea";
import { MentionField } from "@/components/ui/mention-field";
import {
  uploadToCloudinary,
  cloudinaryConfigured,
  type UploadedPhoto,
} from "@/lib/cloudinary-upload";
import { cldFull, cldThumb } from "@/lib/cloudinary-url";
import {
  MAX_PHOTOS_PER_MEMORY,
  MAX_PHOTO_CAPTION,
  UPLOAD_CONCURRENCY,
} from "@/lib/memory-limits";
import { appendMention, collectMentions, mentionToken } from "@/lib/mentions";
import { authClient } from "@/lib/auth-client";
import { ExternalLink, ImagePlus, Link2, Loader2, Play, RotateCw, X } from "lucide-react";
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

/** A photo picked but not yet stored, with the state of its own journey. */
type PendingPhoto = {
  id: string;
  /** Object URL of the local file, shown in the photo's place while it climbs. */
  url: string;
  file: File;
  progress: number;
  error: string | null;
};

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
    /** Optional clock time, "HH:mm". Absent on everything saved before it existed. */
    time?: string | null;
    /*
     * Nullable on purpose — this is what the API returns, not what the draft
     * holds. Declaring the narrower shape hid the mismatch from the compiler.
     */
    photos: {
      url: string;
      publicId: string;
      width?: number | null;
      height?: number | null;
      caption?: string | null;
    }[];
    embeds: { url: string }[];
    tags: string[];
  };
}) {
  const [title, setTitle] = useState(initialMemory?.title ?? initialTitle ?? "");
  const [caption, setCaption] = useState(initialMemory?.caption ?? "");
  /*
   * Time of day, optional.
   *
   * Its own field rather than part of the date, so the memories saved before it
   * existed are untouched and no entry gains an hour nobody recorded.
   */
  const [time, setTime] = useState(() => initialMemory?.time ?? "");
  const [date, setDate] = useState(() => {
    if (initialMemory?.date) return new Date(initialMemory.date).toISOString().slice(0, 10);
    if (initialDate) return initialDate;
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  // Nulls from the API become absent fields, so the draft matches what we send back.
  const [photos, setPhotos] = useState<UploadedPhoto[]>(() =>
    (initialMemory?.photos ?? []).map((p) => ({
      url: p.url,
      publicId: p.publicId,
      width: p.width ?? undefined,
      height: p.height ?? undefined,
      caption: p.caption ?? undefined,
    })),
  );
  /*
   * One entry per photo still on its way up, each carrying its own progress and
   * its own failure. They used to travel as a single batch through Promise.all,
   * which rejects on the first error and discards every result — so one photo
   * losing the connection threw away the nine that had already arrived, and the
   * person had to pick all ten again.
   */
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const photosRef = useRef<HTMLDivElement>(null);

  /*
   * Bring the thumbnails into view the moment they appear.
   *
   * The picker sits above the list, and on a phone the list starts below the
   * fold of the sheet — so choosing a photo produced a change the person who
   * chose it could not see, and it read as nothing having happened. Scrolling
   * on the count going UP, not on every render, so removing a photo does not
   * yank the view around while someone is tidying up.
   *
   * `block: "nearest"` does nothing when the block is already on screen, which
   * is the common case from the second photo onward.
   */
  const shownCount = photos.length + pending.length;
  const prevShown = useRef(shownCount);
  useEffect(() => {
    if (shownCount > prevShown.current) {
      photosRef.current?.scrollIntoView({
        // The global reduced-motion guard only reaches CSS transitions; a
        // scripted scroll has to ask for itself.
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "nearest",
      });
    }
    prevShown.current = shownCount;
  }, [shownCount]);
  const [tags, setTags] = useState<string[]>(initialMemory?.tags ?? []);
  const [embeds, setEmbeds] = useState<ParsedEmbed[]>(() => {
    if (initialMemory?.embeds) {
      return initialMemory.embeds.map((e) => parseEmbed(e.url));
    }
    return [];
  });
  const toast = useToast();
  const [linkInput, setLinkInput] = useState("");
  /** Something is still climbing; a photo sitting in an error state is not. */
  const uploading = pending.some((p) => !p.error);
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
  const onError = (err: any) => toast("Lưu thất bại: " + (readableFormError(err?.message, "Thử lại nhé")), "error");
  const signUpload = trpc.upload.sign.useMutation();
  /*
   * Who can be named. A space holds two people, so in practice this is "the
   * other one" — read from the space rather than assumed, because a personal
   * space has nobody to name and the buttons should not appear there.
   */
  const { data: session } = authClient.useSession();
  const membersQuery = trpc.space.members.useQuery(undefined, { staleTime: 300_000 });
  const mentionable = useMemo(
    () =>
      (membersQuery.data ?? [])
        .filter((m) => m.id !== session?.user.id && m.name?.trim())
        .map((m) => ({ id: m.id, name: m.name as string })),
    [membersQuery.data, session?.user.id],
  );

  /*
   * Names are read out of the words at save time, never tracked beside them.
   * Edit the sentence and the mention follows; a list kept in parallel keeps
   * notifying someone whose name has already been deleted.
   */
  const mentionIds = () =>
    collectMentions([caption, ...photos.map((x) => x.caption ?? "")].join("\n"), mentionable);
  const create = trpc.memory.create.useMutation({ onSuccess, onError });
  const update = trpc.memory.update.useMutation({ onSuccess, onError });

  /*
   * Show the picked files immediately, from the browser's own copy, instead of
   * waiting for the round trip. Cloudinary can take several seconds on a phone
   * connection, and until it answered there was nothing on screen at all — no
   * way to tell whether the right picture had been chosen, or whether the tap
   * had registered.
   */
  async function onFiles(files: FileList | null) {
    if (!files) return;
    setErr(null);
    const slots = Math.max(0, MAX_PHOTOS_PER_MEMORY - photos.length - pending.length);
    const picked = Array.from(files).slice(0, slots);
    if (picked.length === 0) return;

    const items: PendingPhoto[] = picked.map((file, i) => ({
      id: `${Date.now()}-${i}-${file.name}`,
      url: URL.createObjectURL(file),
      file,
      progress: 0,
      error: null,
    }));
    setPending((p) => [...p, ...items]);
    /*
     * A queue, not all at once.
     *
     * Thirty files leaving a phone together is thirty requests dividing one
     * uplink: every one of them crawls, and the browser silently holds most of
     * them where no progress bar can see. Three in the air keeps each running
     * bar moving, and the rest start the instant a slot frees.
     */
    void runUploadQueue(items);
  }

  /*
   * Each photo climbs on its own. A failure parks that one thumbnail in an
   * error state with a way to try again, and leaves every other photo — and
   * everything already typed into the form — exactly where it was.
   */
  async function startUpload(item: PendingPhoto) {
    const patch = (fields: Partial<PendingPhoto>) =>
      setPending((ps) => ps.map((p) => (p.id === item.id ? { ...p, ...fields } : p)));
    patch({ error: null, progress: 0 });
    try {
      const uploaded = await uploadToCloudinary(item.file, {
        // The server authorises each upload; the browser no longer carries a
        // credential that would let it post anything on its own.
        sign: () => signUpload.mutateAsync(),
        onProgress: (fraction) => patch({ progress: fraction }),
      });
      setPhotos((p) => [...p, uploaded]);
      setPending((ps) => ps.filter((p) => p.id !== item.id));
      // Release the object URL: it pins the file in memory until revoked, and
      // ten phone photos is tens of megabytes held for the life of the tab.
      URL.revokeObjectURL(item.url);
    } catch (e) {
      patch({
        progress: 0,
        error: e instanceof Error ? e.message : "Tải ảnh lên thất bại",
      });
    }
  }

  /** Runs the picked files through a fixed number of parallel slots. */
  async function runUploadQueue(items: PendingPhoto[]) {
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        const item = items[next++];
        await startUpload(item);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, items.length) }, worker),
    );
  }

  /** Give up on one photo that would not upload. */
  function dismissPending(id: string) {
    setPending((ps) => {
      const gone = ps.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return ps.filter((p) => p.id !== id);
    });
  }

  /*
   * Object URLs outlive the component unless revoked, and a closed form still
   * holding ten phone photos is tens of megabytes the tab never gets back.
   * Reading through a ref so this runs on unmount only, not on every change.
   */
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  useEffect(
    () => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  );

  /** Write a note under one picture. Saved with the memory, not on its own. */
  function setPhotoCaption(publicId: string, text: string) {
    setPhotos((ps) =>
      ps.map((p) => (p.publicId === publicId ? { ...p, caption: text } : p)),
    );
  }

  /** Drop one picture from the draft. Nothing is saved until the form is. */
  function removePhoto(publicId: string) {
    setPhotos((p) => p.filter((x) => x.publicId !== publicId));
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
      <MentionField
        multiline
        members={mentionable}
        placeholder="Kể lại cảm xúc, chi tiết (tuỳ chọn)"
        value={caption}
        onChange={setCaption}
        rows={3}
        className={TEXTAREA_CLASS}
      />
      {mentionable.length > 0 && (
        <div className="-mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground text-xs">Nhắc tên:</span>
          {mentionable.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setCaption((c) => appendMention(c, m.name))}
              className="border-border text-accent hover:bg-accent-soft rounded-full border px-2 py-0.5 text-xs font-medium"
            >
              {mentionToken(m.name)}
            </button>
          ))}
        </div>
      )}
      {/* Hour first, then the day. Both on the card's own white rather than the
          page grey they used to sit on — a filled-grey box among white ones is
          how every form on earth spells "you cannot type here", and people read
          it that way even though both have always been editable. */}
      <div className="flex items-center gap-2">
        <div className="relative w-[8.25rem] shrink-0">
          <input
            type="time"
            aria-label="Giờ của kỷ niệm (không bắt buộc)"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="border-border bg-card text-foreground h-11 w-full rounded-xl border pl-3 pr-9 text-sm font-medium shadow-sm outline-none focus:border-accent"
          />
          {/* Inside the field, not hanging off its corner. At -right-2 this sat
              8px beyond the row and pushed past the form's right margin — and
              the row is now flush with it, so there is nowhere for it to hang. */}
          {time && (
            <button
              type="button"
              onClick={() => setTime("")}
              aria-label="Xoá giờ"
              className="text-muted-foreground hover:text-foreground hover:bg-muted absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-sm"
            >
              ×
            </button>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <DatePicker value={date} onChange={setDate} />
        </div>
      </div>
      <p className="text-muted-foreground -mt-1.5 text-xs">
        Giờ là tuỳ chọn — để trống nếu chỉ nhớ ngày.
      </p>

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

      <p className="text-muted-foreground text-xs font-medium ml-0.5">Thêm ảnh (tuỳ chọn) · tối đa {MAX_PHOTOS_PER_MEMORY}</p>

      {cloudinaryConfigured ? (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 sm:p-6
            ${
              photos.length + pending.length >= MAX_PHOTOS_PER_MEMORY
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
              {uploading ? "Đang tải lên — chọn thêm được" : "Chạm để tải ảnh lên"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {photos.length + pending.length >= MAX_PHOTOS_PER_MEMORY
                ? `Đã đạt tối đa ${MAX_PHOTOS_PER_MEMORY} ảnh`
                : `Ảnh gốc từ máy, không cần thu nhỏ trước. Tối đa ${MAX_PHOTOS_PER_MEMORY} ảnh.`}
            </p>
          </div>
          <input
            aria-label="Chọn ảnh từ máy"
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => onFiles(e.target.files)}
            disabled={photos.length + pending.length >= MAX_PHOTOS_PER_MEMORY}
          />
        </label>
      ) : (
        <p className="text-muted-foreground text-xs">
          Thêm ảnh cần cấu hình <code>NEXT_PUBLIC_CLOUDINARY_*</code>.
        </p>
      )}
      {uploading && <p className="text-muted-foreground text-xs">Đang tải ảnh…</p>}
      {(photos.length > 0 || pending.length > 0) && (
        <div ref={photosRef} className="scroll-mt-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              {photos.length} ảnh
              {pending.some((p) => !p.error)
                ? ` · đang tải ${pending.filter((p) => !p.error).length}`
                : ""}
              {pending.some((p) => p.error)
                ? ` · ${pending.filter((p) => p.error).length} lỗi`
                : ""}
            </p>
            {photos.length > 1 && (
              <button
                type="button"
                onClick={() => setPhotos([])}
                className="text-muted-foreground hover:text-destructive text-xs underline-offset-2 hover:underline"
              >
                Xoá hết ảnh
              </button>
            )}
          </div>
          {/* 80px rather than 64: at 64 a photo of a place and a photo of a
              plate of food are the same brown smudge, and the point of the
              thumbnail is to tell you whether you picked the right one. */}
          {/*
            A card per photo instead of a bare thumbnail: each one now carries its own
            line. The picture stays big enough to tell a plate of food from a street,
            and the note sits under it — where it sits when the memory is read back.
          */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {photos.map((p) => (
              <div
                key={p.publicId}
                className="border-border bg-card/60 relative flex flex-col gap-1.5 rounded-xl border p-1.5"
              >
                <PhotoView src={cldFull(p.url)}>
                  <img
                    src={cldThumb(p.url, 300)}
                    alt=""
                    width={300}
                    height={300}
                    className="bg-muted aspect-square w-full cursor-zoom-in rounded-lg object-cover"
                  />
                </PhotoView>
                <div className="flex items-center gap-0.5">
                  <MentionField
                    members={mentionable}
                    value={p.caption ?? ""}
                    onChange={(next) => setPhotoCaption(p.publicId, next)}
                    maxLength={MAX_PHOTO_CAPTION}
                    placeholder="Cảm nhận riêng…"
                    aria-label="Cảm nhận riêng cho ảnh này"
                    containerClassName="min-w-0 flex-1"
                    className="text-foreground placeholder:text-muted-foreground focus-visible:bg-muted/60 w-full rounded-md bg-transparent px-1.5 py-1 text-xs outline-none"
                  />
                  {mentionable.map((mem) => (
                    <button
                      key={mem.id}
                      type="button"
                      onClick={() =>
                        setPhotoCaption(p.publicId, appendMention(p.caption ?? "", mem.name))
                      }
                      aria-label={`Nhắc tên ${mem.name} trong ảnh này`}
                      className="text-accent hover:bg-accent-soft shrink-0 rounded-md px-1.5 py-1 text-xs font-bold"
                    >
                      @
                    </button>
                  ))}
                </div>
                {/* Always visible, not hover-only: this form is used on a phone
                    more than anywhere else, and there is no hover there. */}
                <button
                  type="button"
                  onClick={() => removePhoto(p.publicId)}
                  aria-label="Xoá ảnh này"
                  className="bg-card text-muted-foreground hover:bg-destructive hover:text-destructive-foreground border-border absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {pending.map((item) => (
              <div key={item.id} className="relative">
                <img
                  src={item.url}
                  alt=""
                  className={`border-border h-20 w-20 rounded-xl border object-cover ${
                    item.error ? "opacity-40 grayscale" : "opacity-60"
                  }`}
                />
                {item.error ? (
                  <>
                    <button
                      type="button"
                      onClick={() => startUpload(item)}
                      aria-label={`Thử tải lại ảnh này. ${item.error}`}
                      title={item.error}
                      className="bg-card/85 text-destructive absolute inset-0 flex flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-semibold"
                    >
                      <RotateCw className="h-4 w-4" />
                      Thử lại
                    </button>
                    <button
                      type="button"
                      onClick={() => dismissPending(item.id)}
                      aria-label="Bỏ ảnh này"
                      className="bg-card text-muted-foreground hover:bg-destructive hover:text-destructive-foreground border-border absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="text-accent h-5 w-5 animate-spin" />
                    </span>
                    {/* A number that moves is the difference between "it is
                        working" and "it is stuck". Ten photos over a phone
                        connection is a minute of otherwise silent waiting. */}
                    <span className="bg-card/85 absolute inset-x-1 bottom-1 h-1 overflow-hidden rounded-full">
                      <span
                        className="bg-accent block h-full rounded-full transition-[width] duration-200"
                        style={{ width: `${Math.round(item.progress * 100)}%` }}
                      />
                    </span>
                  </>
                )}
              </div>
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
                  time: time || undefined,
                  photos,
                  embeds: collectAllEmbeds(),
                  tags,
                  mentions: mentionIds(),
                });
              } else {
                create.mutate({
                  title,
                  caption: caption || undefined,
                  date: new Date(date),
                  time: time || undefined,
                  photos,
                  embeds: collectAllEmbeds(),
                  tags,
                  mentions: mentionIds(),
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

