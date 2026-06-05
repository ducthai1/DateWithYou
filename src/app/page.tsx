import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="space-y-3">
        <p className="text-4xl">💞</p>
        <h1 className="text-4xl font-semibold tracking-tight">Chuyện của Cá</h1>
        <p className="text-muted-foreground text-sm">
          Nơi lưu kỷ niệm, lên kế hoạch hẹn hò và giữ những điều bí mật ngọt
          ngào của tụi mình.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/map"
          className="bg-accent text-accent-foreground flex h-12 items-center justify-center rounded-xl font-medium"
        >
          Vào không gian
        </Link>
        <Link
          href="/sign-up"
          className="border-border flex h-12 items-center justify-center rounded-xl border font-medium"
        >
          Tạo tài khoản
        </Link>
      </div>
    </main>
  );
}
