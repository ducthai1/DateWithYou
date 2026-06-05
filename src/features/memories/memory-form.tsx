"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  uploadToCloudinary,
  cloudinaryConfigured,
  type UploadedPhoto,
} from "@/lib/cloudinary-upload";

export function MemoryForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
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
    <div className="border-border space-y-3 rounded-xl border p-4">
      <Input placeholder="Tiêu đề kỷ niệm" value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea
        placeholder="Kể lại một chút…"
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        className="border-border bg-background w-full rounded-xl border p-3 text-sm"
        rows={3}
      />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      {cloudinaryConfigured ? (
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          disabled={uploading || photos.length >= 10}
          className="text-sm"
        />
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
      {err && <p className="text-sm text-red-600">{err}</p>}

      <div className="flex gap-2">
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
      </div>
    </div>
  );
}
