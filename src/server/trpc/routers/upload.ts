import { TRPCError } from "@trpc/server";
import { v2 as cloudinary } from "cloudinary";
import { protectedProcedure, adminProcedure, router } from "@/server/trpc/trpc";
import { env } from "@/lib/env";

/**
 * Handing the browser permission to upload one file, and nothing else.
 *
 * The browser has to do the upload itself — a photo should not travel through
 * this server on its way to storage — but it was doing so with an UNSIGNED
 * preset, and the credentials for that are `NEXT_PUBLIC_`, which is to say
 * printed in the JavaScript every visitor downloads. Anyone who read the bundle
 * could post any file into the account: burn the storage quota, or worse, park
 * something illegal in a cloud that has this project's name on it.
 *
 * A signature costs one round trip and closes that. It is minted per request,
 * only for a signed-in member, and covers the exact parameters the upload is
 * allowed to use — Cloudinary rejects the request if the browser sends anything
 * that was not signed, so the client cannot widen its own permission.
 */

/** Uploads land under the space that asked for them. */
const ROOT_FOLDER = "memories";

/**
 * Cloudinary reckons expiry from this and refuses a stale one, so a signature
 * lifted from one visitor's network log is of no use for long.
 */
const nowSeconds = () => Math.round(Date.now() / 1000);

export const uploadRouter = router({
  sign: protectedProcedure.mutation(({ ctx }) => {
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!apiKey || !apiSecret) {
      /*
       * Loud, not silent. Both are optional in the env schema, so a deployment
       * can be missing them and still boot — and the failure would otherwise
       * surface as photos that simply never upload, with nothing anywhere
       * saying why.
       */
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Server chưa cấu hình CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET nên chưa tải ảnh lên được.",
      });
    }

    const timestamp = nowSeconds();
    /*
     * The folder is inside the signature, which is what makes it a boundary
     * rather than a convention: a client cannot move its uploads into another
     * space's folder without invalidating the signature it was given.
     */
    const folder = `${ROOT_FOLDER}/${ctx.spaceId}`;
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);

    return { apiKey, timestamp, folder, signature };
  }),

  /**
   * The same signed upload, but for blog images: gated to an admin and folded
   * into a "blog" folder instead of a couple's space, since posts are public
   * content and not space-scoped.
   */
  signBlog: adminProcedure.mutation(() => {
    const apiKey = env.CLOUDINARY_API_KEY;
    const apiSecret = env.CLOUDINARY_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "Server chưa cấu hình CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET nên chưa tải ảnh lên được.",
      });
    }
    const timestamp = nowSeconds();
    const folder = "blog";
    const signature = cloudinary.utils.api_sign_request({ folder, timestamp }, apiSecret);
    return { apiKey, timestamp, folder, signature };
  }),
});
