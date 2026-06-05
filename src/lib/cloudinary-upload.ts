// Client-side unsigned upload to Cloudinary. The preset (locked to folder /
// formats / size in the Cloudinary dashboard) means no API secret ships to the
// browser. Returns the data we persist on the memory document.

const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type UploadedPhoto = {
  url: string;
  publicId: string;
  width?: number;
  height?: number;
};

export const cloudinaryConfigured = Boolean(CLOUD && PRESET);

export async function uploadToCloudinary(file: File): Promise<UploadedPhoto> {
  if (!CLOUD || !PRESET) {
    throw new Error("Cloudinary chưa cấu hình (NEXT_PUBLIC_CLOUDINARY_*)");
  }
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
    { method: "POST", body: form },
  );
  if (!res.ok) throw new Error("Upload thất bại");
  const data = (await res.json()) as {
    secure_url: string;
    public_id: string;
    width?: number;
    height?: number;
  };
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width,
    height: data.height,
  };
}
