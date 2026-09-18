"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { cloudinaryConfigured, uploadToCloudinary, UploadError } from "@/lib/cloudinary-upload";
import { MAX_VIDEO_BYTES, uploadKindOf } from "@/lib/upload-kind";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

/**
 * "hoặc tải từ máy" — cạnh mỗi ô đang bắt dán link.
 *
 * Bộ sưu tập trước đây chỉ nhận link: ảnh bìa phải là một URL https, video nấu
 * ăn phải là một link YouTube. Nghĩa là một đoạn clip tự quay trong bếp thì
 * phải đem lên YouTube trước rồi mới dán vào được — đường vòng đủ dài để người
 * ta bỏ luôn ý định lưu.
 *
 * Trả về URL chứ không trả về file: mọi chỗ trong bộ sưu tập đều đã nhận URL,
 * nên cái nút này chỉ là một cách khác để điền vào đúng ô đó — không đổi hình
 * dạng dữ liệu, không thêm nhánh lưu trữ thứ hai.
 */
export function UploadFromDevice({
  accept,
  onUploaded,
  label = "Tải từ máy",
  className,
}: {
  /** "image/*", "video/*", hoặc cả hai. */
  accept: string;
  onUploaded: (url: string) => void;
  label?: string;
  className?: string;
}) {
  const toast = useToast();
  const sign = trpc.upload.sign.useMutation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);

  if (!cloudinaryConfigured) return null;

  const onPick = async (file: File | null | undefined) => {
    if (!file) return;
    const kind = uploadKindOf(file);
    if (!kind) {
      toast("Chỉ nhận ảnh hoặc video thôi nhé", "error");
      return;
    }
    setProgress(0);
    try {
      const res = await uploadToCloudinary(file, {
        sign: () => sign.mutateAsync(),
        onProgress: setProgress,
      });
      onUploaded(res.url);
      toast(kind === "video" ? "Đã tải video lên ✓" : "Đã tải ảnh lên ✓", "success");
    } catch (err) {
      /*
       * Câu của `UploadError` đã là câu viết cho người đọc — nó biết file quá
       * bao nhiêu MB và là ảnh hay video. Thay bằng một câu chung chung ở đây
       * là vứt đi đúng phần hữu ích nhất.
       */
      toast(err instanceof UploadError ? err.message : "Tải lên thất bại", "error");
    } finally {
      setProgress(null);
      // Chọn lại đúng file vừa rồi vẫn phải kích hoạt được onChange.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const busy = progress !== null;
  return (
    <label
      className={cn(
        "border-border hover:bg-muted inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors",
        busy && "pointer-events-none opacity-60",
        className,
      )}
    >
      {busy ? (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          {Math.round((progress ?? 0) * 100)}%
        </>
      ) : (
        <>
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {label}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        aria-label={label}
        disabled={busy}
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
    </label>
  );
}

/** Nhắc trần dung lượng, để người ta biết trước khi ngồi chờ một phút. */
export const VIDEO_SIZE_HINT = `Video tối đa ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB`;
