// Browser-side upload to Cloudinary, authorised per request by a signature the
// server mints. The file never travels through our server; the permission to
// send it does. See routers/upload.ts for why an unsigned preset was not enough.

import { prepareForUpload } from "@/lib/image-prepare";
import {
  endpointFor,
  maxBytesFor,
  tooLargeMessage,
  uploadKindOf,
  type UploadKind,
} from "@/lib/upload-kind";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

/** What the server hands over for one upload. */
export type UploadTicket = {
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
};

export type UploadedPhoto = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  /**
   * Ảnh hay video.
   *
   * Không suy lại từ đuôi URL lúc hiển thị: một kỷ niệm lưu từ trước không có
   * trường này, và mặc định "image" đúng với tất cả chúng — suy từ URL thì một
   * ảnh tên `.mov.jpg` sẽ được vẽ bằng thẻ <video> và ra một ô đen.
   */
  resourceType?: UploadKind;
  /** Giây, chỉ có ở video. */
  duration?: number;
  /** A note written under this one picture. Carried with the draft, saved with it. */
  caption?: string;
};

/*
 * Only the cloud name now. Whether an upload can actually be authorised is the
 * server's business and is answered when one is attempted — hiding the picker
 * on a guess would hide it from someone whose server is configured fine.
 */
export const cloudinaryConfigured = Boolean(CLOUD);

/** Network trouble is worth retrying; a rejected file never is. */
export class UploadError extends Error {
  readonly retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "UploadError";
    this.retryable = retryable;
  }
}

const RETRY_DELAYS_MS = [700, 2000];

function post(
  file: File,
  kind: UploadKind,
  ticket: UploadTicket,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadError("Đã huỷ", false));
    const form = new FormData();
    form.append("file", file);
    /*
     * Exactly the fields the signature covers, and no others. Cloudinary
     * rejects the request outright if the browser adds a parameter that was not
     * signed, which is the property that stops a client widening its own
     * permission — so this list has to match routers/upload.ts.
     */
    form.append("api_key", ticket.apiKey);
    form.append("timestamp", String(ticket.timestamp));
    form.append("folder", ticket.folder);
    form.append("signature", ticket.signature);

    /*
     * XMLHttpRequest rather than fetch, for one reason: it reports how much of
     * the body has gone out. Ten photos over a phone connection is a minute of
     * waiting, and a minute with no moving indicator reads as a hung app — the
     * upload was working the whole time, but nothing on screen said so.
     */
    const xhr = new XMLHttpRequest();
    /*
     * Đúng endpoint của loại file.
     *
     * Gửi video vào `/image/upload` thì Cloudinary trả 400 kèm "Invalid image
     * file" — đọc câu đó xong người ta tưởng cái video bị hỏng, chứ không nghĩ
     * là mình gửi nhầm cửa.
     */
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD}/${endpointFor(kind)}/upload`);
    xhr.responseType = "json";
    xhr.timeout = 180_000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    const onAbort = () => xhr.abort();
    signal?.addEventListener("abort", onAbort, { once: true });
    const done = () => signal?.removeEventListener("abort", onAbort);

    xhr.onload = () => {
      done();
      const body = xhr.response as
        | { secure_url?: string; public_id?: string; width?: number; height?: number;
            duration?: number; error?: { message?: string } }
        | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url && body.public_id) {
        onProgress?.(1);
        resolve({
          url: body.secure_url,
          publicId: body.public_id,
          width: body.width,
          height: body.height,
          resourceType: kind,
          duration: typeof body.duration === "number" ? body.duration : undefined,
        });
        return;
      }
      const detail = body?.error?.message ?? "";
      // 4xx is a verdict on this file. Sending it again changes nothing.
      const retryable = xhr.status === 0 || xhr.status >= 500 || xhr.status === 429;
      reject(
        new UploadError(
          /file size too large/i.test(detail)
            ? tooLargeMessage(kind)
            : detail || (kind === "video" ? "Tải video lên thất bại" : "Tải ảnh lên thất bại"),
          retryable,
        ),
      );
    };
    xhr.onerror = () => { done(); reject(new UploadError("Mất kết nối khi tải ảnh", true)); };
    xhr.ontimeout = () => { done(); reject(new UploadError("Mạng quá chậm, đã quá hạn chờ", true)); };
    xhr.onabort = () => { done(); reject(new UploadError("Đã huỷ", false)); };
    xhr.send(form);
  });
}

function wait(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => { clearTimeout(t); reject(new UploadError("Đã huỷ", false)); },
      { once: true },
    );
  });
}

export async function uploadToCloudinary(
  input: File,
  opts: {
    /** Asks the server to authorise this upload. One ticket per attempt. */
    sign: () => Promise<UploadTicket>;
    onProgress?: (fraction: number) => void;
    signal?: AbortSignal;
  },
): Promise<UploadedPhoto> {
  if (!CLOUD) {
    throw new UploadError("Cloudinary chưa cấu hình (NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME)", false);
  }

  const kind = uploadKindOf(input);
  if (!kind) {
    throw new UploadError("Chỉ nhận ảnh hoặc video thôi nhé", false);
  }

  /*
   * Video KHÔNG đi qua bước chuẩn bị ảnh.
   *
   * `prepareForUpload` vẽ file lên canvas để resize và nén lại — với một video
   * thì canvas chỉ lấy được MỘT khung hình, và thứ gửi đi sẽ là một tấm ảnh
   * tĩnh mang tên .mp4. Nén video ở phía máy người dùng là việc của một thư
   * viện khác hẳn; ở đây chỉ kiểm dung lượng rồi gửi nguyên bản.
   */
  const prepared = kind === "video" ? { file: input } : await prepareForUpload(input);
  if (prepared.file.size > maxBytesFor(kind)) {
    throw new UploadError(tooLargeMessage(kind), false);
  }

  /*
   * A phone hands the connection between cell and wifi mid-upload, and the
   * request dies through no fault of the photo. Retrying that costs one more
   * attempt; not retrying costs the person their picture.
   */
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      /*
       * A fresh ticket per attempt, not one reused across retries: the
       * signature carries a timestamp Cloudinary checks for staleness, and a
       * retry after two seconds of backoff on a slow connection is exactly
       * where a reused one starts failing for a reason that looks like the
       * network.
       */
      const ticket = await opts.sign();
      return await post(prepared.file, kind, ticket, opts.onProgress, opts.signal);
    } catch (e) {
      lastError = e;
      if (!(e instanceof UploadError) || !e.retryable) throw e;
      if (attempt === RETRY_DELAYS_MS.length) break;
      opts.onProgress?.(0);
      await wait(RETRY_DELAYS_MS[attempt], opts.signal);
    }
  }
  throw lastError;
}
