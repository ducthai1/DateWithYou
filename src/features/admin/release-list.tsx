"use client";

import Link from "next/link";
import { RELEASES } from "@/lib/release-notes";
import { AdminOnly } from "./admin-only";

const KIND_LABEL: Record<string, string> = {
  feature: "Mới",
  fix: "Sửa lỗi",
  speed: "Nhanh hơn",
  polish: "Chỉn chu",
};

/** Danh sách đợt phát hành — mỗi đợt một dòng tóm tắt, bấm vào xem chi tiết. */
export function ReleaseList() {
  return (
    <AdminOnly>
      <div className="space-y-3">
        {RELEASES.map((r) => (
          <Link
            key={r.date}
            href={`/admin/changelog/${r.date}`}
            /* Cả thẻ bấm được, không phải chỉ mỗi tiêu đề — cùng luật với các
               thẻ ngoài trang chủ, xem ghi chú ở `landing-sections`. */
            className="border-border bg-card hover:border-accent/40 block rounded-2xl border p-4 shadow-sm transition-colors"
          >
            <span className="text-muted-foreground text-xs tabular-nums">{r.date}</span>
            <h2 className="mt-1 text-base font-semibold">{r.title}</h2>
            <p className="text-muted-foreground mt-1 text-sm">{r.summary}</p>
            <span className="text-accent-ink mt-2 inline-block text-xs font-medium">
              {r.changes.length} thay đổi →
            </span>
          </Link>
        ))}
      </div>
    </AdminOnly>
  );
}

/** Chi tiết một đợt. */
export function ReleaseDetail({ date }: { date: string }) {
  const release = RELEASES.find((r) => r.date === date);
  return (
    <AdminOnly>
      {!release ? (
        <p className="text-muted-foreground py-16 text-center text-sm">
          Không có đợt phát hành nào vào ngày này.
        </p>
      ) : (
        <div className="space-y-5">
          <Link href="/admin/changelog" className="text-accent-ink text-sm font-medium">
            ← Tất cả các đợt
          </Link>
          <div>
            <p className="text-muted-foreground text-xs tabular-nums">{release.date}</p>
            <h1 className="text-h1 mt-1 font-semibold">{release.title}</h1>
            <p className="text-muted-foreground mt-2 text-sm">{release.summary}</p>
          </div>
          <ul className="space-y-3">
            {release.changes.map((c) => (
              <li key={c.what} className="border-border bg-card rounded-2xl border p-4 shadow-sm">
                <span className="bg-accent-soft text-accent-ink rounded-full px-2.5 py-1 text-[11px] font-medium">
                  {KIND_LABEL[c.kind] ?? c.kind}
                </span>
                <p className="mt-2 font-medium">{c.what}</p>
                <p className="text-muted-foreground mt-1 text-sm">{c.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </AdminOnly>
  );
}
