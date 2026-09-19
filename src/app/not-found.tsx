import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Compass } from "lucide-react";
import { BackdropArt } from "@/components/theme/app-backdrop";

export const metadata: Metadata = {
  title: "Không tìm thấy",
  robots: { index: false, follow: false },
};

/**
 * Warm 404, in two versions.
 *
 * For someone signed in it stays inside the app: chrome, accent theme, and two
 * places worth going. For a stranger who mistyped a URL it was showing the
 * whole private navigation — every section of the app, plus two buttons that
 * only bounce them to the sign-in page. A 404 is a public URL; it should give
 * a visitor nothing but the way in.
 */
export default async function NotFound() {
  const jar = await cookies();
  const signedIn = jar.getAll().some((c) => c.name.includes("session_token"));

  return (
    <div
      // Read by globals.css to strip the app chrome for a signed-out visitor.
      data-chromeless={signedIn ? undefined : ""}
      /*
       * Và để nền chung tự tắt đi, nhường chỗ cho nền riêng ngay bên dưới.
       *
       * `AppBackdrop` chọn hình theo tiền tố đường dẫn, nên một URL gõ sai hoặc
       * trúng hình của khu vực nó định vào, hoặc rơi vào hình dự phòng — kiểu
       * nào cũng là mượn nền chỗ khác, và trang báo "không tìm thấy" lại trông
       * y như trang vừa rời đi.
       */
      data-notfound=""
      className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-4 px-4 py-16 text-center"
    >
      {/* Chiếc la bàn rỗng: đúng nghĩa lạc đường, và là hình app đã có sẵn cho
          các trạng thái trống nên không cần thêm asset mới. */}
      <BackdropArt art="emptyCompass" />
      <span
        className="bg-accent-soft flex h-16 w-16 items-center justify-center rounded-full"
        aria-hidden="true"
      >
        <Compass className="text-accent h-7 w-7" strokeWidth={1.6} />
      </span>

      <div className="space-y-1.5">
        <h1 className="text-h1 font-semibold">Lạc đường mất rồi</h1>
        <p className="text-muted-foreground text-sm">
          Trang này không có ở đây. Có thể đường dẫn đã cũ, hoặc tụi mình vừa dọn nó đi chỗ khác.
        </p>
      </div>

      <div className="flex w-full flex-col gap-2 pt-1 sm:w-auto sm:flex-row">
        <Link
          href={signedIn ? "/home" : "/"}
          className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {signedIn ? "Về Hôm nay" : "Về trang chủ"}
        </Link>
        <Link
          href={signedIn ? "/timeline" : "/sign-in"}
          className="border-border bg-card hover:bg-muted focus-visible:ring-ring/50 inline-flex h-11 items-center justify-center rounded-xl border px-5 text-sm font-medium shadow-sm outline-none transition-all active:scale-[.98] focus-visible:ring-2 focus-visible:ring-offset-2"
        >
          {signedIn ? "Xem kỷ niệm" : "Đăng nhập"}
        </Link>
      </div>
    </div>
  );
}
