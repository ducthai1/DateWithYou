import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { env } from "@/lib/env";

let configured = false;
function ensureConfigured() {
  if (configured) return;
  cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
  configured = true;
}

/** Delete assets by publicId. Best-effort: never throws (cleanup must not block). */
export async function destroyAssets(publicIds: string[]): Promise<void> {
  if (publicIds.length === 0 || !env.CLOUDINARY_API_SECRET) return;
  ensureConfigured();
  await Promise.all(
    publicIds.map((id) =>
      cloudinary.uploader.destroy(id).catch(() => undefined),
    ),
  );
}
