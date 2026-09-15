"use client";

import { AlertTriangle, Check, Loader2 } from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";

/**
 * What is failing, and how often.
 *
 * Plain on purpose. This screen is read when something is already wrong, so
 * it shows the thing that broke, where, how many times and when it last
 * happened — and nothing else competing for the eye.
 */
export function ErrorLogScreen() {
  const toast = useToast();
  const utils = trpc.useUtils();
  const errors = trpc.ops.errors.useQuery({ limit: 100 });
  const dismiss = trpc.ops.dismissError.useMutation({
    onSuccess: () => {
      utils.ops.errors.invalidate();
      toast("Đã bỏ qua — nó sẽ hiện lại nếu lỗi tái diễn", "success");
    },
    onError: (e) => toast(e.message, "error"),
  });

  const when = (d: Date | string) =>
    new Date(d).toLocaleString("vi-VN", { hour12: false, timeZone: "Asia/Ho_Chi_Minh" });

  return (
    <PageShell
      header={
        <PageHeader
          title="Lỗi máy chủ"
          subtitle="Gộp theo từng loại lỗi, giữ 14 ngày rồi tự xoá."
        />
      }
    >
      {errors.isPending ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : errors.error ? (
        <EmptyState
          icon="lock"
          title="Trang này chỉ dành cho quản trị"
          subtitle="Tài khoản của bạn không nằm trong ADMIN_EMAILS."
        />
      ) : !errors.data?.length ? (
        <EmptyState
          art="emptyCanvas"
          icon="check"
          title="Không có lỗi nào"
          subtitle="Trong 14 ngày qua chưa có thủ tục nào hỏng ngoài dự kiến."
        />
      ) : (
        <div className="space-y-3">
          {errors.data.map((e) => (
            <Card key={e.id} className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-mono text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                    {e.where}
                  </p>
                  <p className="text-muted-foreground mt-1 break-words text-sm">{e.message}</p>
                </div>
                <span className="bg-destructive-soft text-destructive shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular-nums">
                  ×{e.count}
                </span>
              </div>
              <p className="text-muted-foreground text-xs tabular-nums">
                lần đầu {when(e.firstAt)} · gần nhất {when(e.lastAt)}
              </p>
              {e.stack && (
                <pre className="bg-muted text-muted-foreground overflow-x-auto rounded-lg p-2 text-[11px] leading-relaxed">
                  {e.stack}
                </pre>
              )}
              <button
                type="button"
                onClick={() => dismiss.mutate({ id: e.id })}
                disabled={dismiss.isPending}
                className="text-muted-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition-colors"
                style={{ minHeight: 36 }}
              >
                {dismiss.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                Đã xử lý
              </button>
            </Card>
          ))}
        </div>
      )}
    </PageShell>
  );
}
