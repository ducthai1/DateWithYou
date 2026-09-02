/*
 * Make a picked photo fit what the storage plan will accept — without asking
 * the person who picked it to do anything about it.
 *
 * Cloudinary's free plan refuses any image over 10 MB. The refusal arrives from
 * the server, which means a 56 MB photo is pushed all the way up the phone's
 * uplink — measured at 47 seconds — before anyone is told it was never going to
 * work. So the size is settled here, before a single byte leaves the device.
 *
 * The rule is deliberately narrow: a photo that already fits is passed through
 * BYTE FOR BYTE, the same File object, untouched. Ordinary phone photos are 2-5
 * MB and never reach the re-encoding path at all. Only a photo that would
 * otherwise be rejected outright gets shrunk, and then only as far as it takes
 * to fit — because the alternative for that photo is not "keep it pristine", it
 * is "lose it".
 */

/** Cloudinary free plan, verified by upload: "Maximum is 10485760". */
export const MAX_UPLOAD_BYTES = 10_485_760;

/** Leave room so a re-encode that lands just under the cap still passes. */
const TARGET_BYTES = Math.floor(MAX_UPLOAD_BYTES * 0.94);

/*
 * Safari on iOS silently returns a blank canvas past roughly 16.7 million
 * pixels, so a 48 MP photo cannot be re-encoded at full size on an iPhone — it
 * comes back empty rather than failing. Staying under the ceiling keeps that
 * from happening. It only ever applies to photos already over 10 MB, and even
 * then leaves far more detail than any screen can show.
 */
const MAX_PIXELS = 16_000_000;

const QUALITY_STEPS = [0.92, 0.86, 0.8, 0.72];
const SCALE_STEPS = [1, 0.8, 0.64, 0.5];

export type PreparedImage = {
  file: File;
  /** True when the bytes differ from what was picked. */
  changed: boolean;
  originalBytes: number;
};

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/*
 * WebP holds noticeably more detail than JPEG at the same file size, so when a
 * photo has to lose something to fit, it loses less. Delivery is f_auto anyway,
 * so what is stored need not match what any browser is served. Safari only
 * learned to ENCODE WebP in 16.4, and older versions quietly hand back a PNG
 * instead of refusing, so the type that comes back is what decides.
 */
async function encode(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; ext: string } | null> {
  const webp = await canvasToBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
  const jpeg = await canvasToBlob(canvas, "image/jpeg", quality);
  if (jpeg) return { blob: jpeg, ext: "jpg" };
  return null;
}

function renamed(name: string, ext: string): string {
  const stem = name.replace(/\.[^.]+$/, "") || "anh";
  return `${stem}.${ext}`;
}

export async function prepareForUpload(file: File): Promise<PreparedImage> {
  const originalBytes = file.size;
  if (file.size <= MAX_UPLOAD_BYTES) {
    return { file, changed: false, originalBytes };
  }

  /*
   * imageOrientation "from-image" applies the EXIF rotation while decoding.
   * Without it a photo taken in portrait is re-encoded lying on its side, and
   * the rotation flag that would have corrected it is gone with the rest of the
   * metadata. A decode that fails (an iPhone HEIC in a browser that cannot read
   * one) is not an error here — the original goes up and the server, which does
   * understand the format, decides.
   */
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return { file, changed: false, originalBytes };
  }

  try {
    const pixels = bitmap.width * bitmap.height;
    const ceiling = pixels > MAX_PIXELS ? Math.sqrt(MAX_PIXELS / pixels) : 1;

    for (const scale of SCALE_STEPS) {
      const factor = ceiling * scale;
      const w = Math.max(1, Math.round(bitmap.width * factor));
      const h = Math.max(1, Math.round(bitmap.height * factor));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) break;
      ctx.drawImage(bitmap, 0, 0, w, h);

      for (const quality of QUALITY_STEPS) {
        const out = await encode(canvas, quality);
        if (!out) break;
        if (out.blob.size <= TARGET_BYTES) {
          return {
            file: new File([out.blob], renamed(file.name, out.ext), {
              type: out.blob.type,
              lastModified: file.lastModified,
            }),
            changed: true,
            originalBytes,
          };
        }
      }
    }
    // Nothing fit. Send the original and let the server give the real reason.
    return { file, changed: false, originalBytes };
  } finally {
    bitmap.close();
  }
}
