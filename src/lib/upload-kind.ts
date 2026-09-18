/**
 * Ảnh hay video, và mỗi loại đi đường nào.
 *
 * Trước đây đường tải lên chỉ có một: nén ảnh rồi bắn vào `/image/upload`. Kỷ
 * niệm thì quảng cáo là lưu được video, mà ô chọn file lại `accept="image/*"` —
 * nên không có cách nào chọn video, và người dùng báo đúng chuyện đó.
 *
 * Ba thứ khác nhau giữa hai loại, và bỏ sót thứ nào cũng hỏng theo kiểu riêng:
 *
 *   endpoint  — `/video/upload` chứ không phải `/image/upload`. Gửi nhầm thì
 *               Cloudinary trả 400 với câu "Invalid image file", đọc xong tưởng
 *               file hỏng.
 *   chuẩn bị  — ảnh được resize/nén trước khi gửi; làm thế với video thì canvas
 *               chỉ vẽ ra được MỘT KHUNG HÌNH, và thứ gửi đi là một tấm ảnh
 *               tĩnh mang tên .mp4.
 *   giới hạn  — nhà cung cấp chặn ảnh ở 10 MB và video ở 100 MB. Dùng chung một
 *               con số thì hoặc chặn oan mọi video, hoặc để video 60 MB bay lên
 *               rồi bị từ chối sau khi người ta đã chờ hết một phút.
 */

export type UploadKind = "image" | "video";

/** Trần của gói Cloudinary đang dùng, tra ở bảng so sánh gói ngày 18/09/2026. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/**
 * Loại của một file, theo MIME chứ không theo đuôi tên.
 *
 * Đuôi tên là thứ người dùng đổi được và điện thoại đôi khi đặt sai; `type` là
 * thứ trình duyệt tự đọc ra. Máy Android thỉnh thoảng trả chuỗi rỗng cho file
 * lấy từ vài ứng dụng thư viện, nên có đường lùi về đuôi tên — nhưng chỉ khi
 * không còn gì khác để dựa vào.
 */
export function uploadKindOf(file: { type?: string; name?: string }): UploadKind | null {
  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("image/")) return "image";
  if (!mime) {
    const ext = (file.name || "").toLowerCase().match(/\.([a-z0-9]+)$/)?.[1];
    if (!ext) return null;
    if (["mp4", "mov", "m4v", "webm", "avi", "mkv", "3gp"].includes(ext)) return "video";
    if (["jpg", "jpeg", "png", "gif", "webp", "avif", "heic", "heif"].includes(ext)) return "image";
  }
  return null;
}

/** Trần byte cho loại đó. */
export function maxBytesFor(kind: UploadKind): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/** Đoạn đường trên URL Cloudinary. */
export function endpointFor(kind: UploadKind): "image" | "video" {
  return kind;
}

/** Câu nói cho người đang đứng trước màn hình khi file bị từ chối. */
export function tooLargeMessage(kind: UploadKind): string {
  return kind === "video"
    ? `Video quá ${Math.round(MAX_VIDEO_BYTES / 1024 / 1024)} MB — quay ngắn lại hoặc giảm chất lượng trong máy rồi thử lại nhé.`
    : `Ảnh quá ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB so với giới hạn lưu trữ.`;
}

/**
 * Ảnh đại diện cho một video đã tải lên.
 *
 * Cloudinary dựng khung hình đầu bằng cách đổi đuôi của chính public id sang
 * `.jpg`. Rẻ hơn hẳn việc tự vẽ canvas ở máy người dùng, và nó chạy được cả
 * trên gói free — bảng so sánh gói ghi rõ transcoding và transformation video
 * nằm trong gói đó.
 */
export function videoPosterUrl(secureUrl: string): string {
  return secureUrl.replace(/\.(mp4|mov|m4v|webm|avi|mkv|3gp)(\?.*)?$/i, ".jpg");
}
