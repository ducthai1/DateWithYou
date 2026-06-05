"use client";

import { trpc } from "@/lib/trpc";

export default function Home() {
  const health = trpc.health.check.useQuery();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="text-4xl font-semibold tracking-tight">Chuyện của Cá</h1>
        <p className="text-muted-foreground text-sm">
          Nơi lưu kỷ niệm và lên kế hoạch hẹn hò của tụi mình.
        </p>
      </div>

      <div className="border-border bg-muted/40 w-full rounded-xl border p-4 text-sm">
        <p className="text-muted-foreground mb-2 font-medium">
          Trạng thái hệ thống
        </p>
        {health.isLoading ? (
          <p>Đang kiểm tra…</p>
        ) : health.isError ? (
          <p className="text-red-600">Lỗi kết nối API</p>
        ) : (
          <ul className="space-y-1">
            <li>API: {health.data?.ok ? "✅ OK" : "❌"}</li>
            <li>
              Database:{" "}
              {health.data?.dbConnected
                ? "✅ Đã kết nối"
                : "⚠️ Chưa kết nối (đặt MONGODB_URI)"}
            </li>
          </ul>
        )}
      </div>
    </main>
  );
}
