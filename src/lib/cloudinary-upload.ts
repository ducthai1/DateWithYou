// Client-side unsigned upload to Cloudinary. Unsigned means no API secret ships
// to the browser; what the preset itself permits is set in the Cloudinary
// dashboard, not here.

import { MAX_UPLOAD_BYTES, prepareForUpload } from "@/lib/image-prepare";

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type UploadedPhoto = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
};

export const cloudinaryConfigured = Boolean(CLOUD && PRESET);

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
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new UploadError("Đã huỷ", false));
    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", PRESET as string);

    /*
     * XMLHttpRequest rather than fetch, for one reason: it reports how much of
     * the body has gone out. Ten photos over a phone connection is a minute of
     * waiting, and a minute with no moving indicator reads as a hung app — the
     * upload was working the whole time, but nothing on screen said so.
     */
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`);
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
            error?: { message?: string } }
        | null;
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url && body.public_id) {
        onProgress?.(1);
        resolve({
          url: body.secure_url,
          publicId: body.public_id,
          width: body.width,
          height: body.height,
        });
        return;
      }
      const detail = body?.error?.message ?? "";
      // 4xx is a verdict on this file. Sending it again changes nothing.
      const retryable = xhr.status === 0 || xhr.status >= 500 || xhr.status === 429;
      reject(
        new UploadError(
          /file size too large/i.test(detail)
            ? "Ảnh quá lớn so với giới hạn lưu trữ"
            : detail || "Tải ảnh lên thất bại",
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
  opts: { onProgress?: (fraction: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedPhoto> {
  if (!CLOUD || !PRESET) {
    throw new UploadError("Cloudinary chưa cấu hình (NEXT_PUBLIC_CLOUDINARY_*)", false);
  }

  const prepared = await prepareForUpload(input);
  if (prepared.file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError("Ảnh quá lớn so với giới hạn lưu trữ", false);
  }

  /*
   * A phone hands the connection between cell and wifi mid-upload, and the
   * request dies through no fault of the photo. Retrying that costs one more
   * attempt; not retrying costs the person their picture.
   */
  let lastError: unknown;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await post(prepared.file, opts.onProgress, opts.signal);
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
