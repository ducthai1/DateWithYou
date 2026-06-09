"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  uploadToCloudinary,
  cloudinaryConfigured,
  type UploadedPhoto,
} from "@/lib/cloudinary-upload";
import { ImagePlus } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { ModalContent, ModalFooter } from "@/components/ui/modal";

export function MemoryForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const utils = trpc.useUtils();
  const create = trpc.memory.create.useMutation({
    onSuccess: () => {
      utils.memory.list.invalidate();
      onDone();
    },
  });

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

  return (
    <>
      <ModalContent className="space-y-4">
        <Input placeholder="Tiêu đề kỷ niệm" value={title} onChange={(e) => setTitle(e.target.value)} />
      <Textarea
        placeholder="Kể lại một chút…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
      />
      <DatePicker value={date} onChange={setDate} />

      {cloudinaryConfigured ? (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-all duration-200
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
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <img key={p.publicId} src={p.url} alt="" className="h-16 w-16 rounded-lg object-cover" />
          ))}
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
        <Button
          className="flex-1"
          disabled={!title.trim() || create.isPending || uploading}
          onClick={() =>
            create.mutate({
              title: title.trim(),
              caption: caption.trim() || undefined,
              date: new Date(date),
              photos,
            })
          }
        >
          {create.isPending ? "Đang lưu…" : "Lưu kỷ niệm"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Huỷ
        </Button>
      </ModalFooter>
    </>
  );
}
