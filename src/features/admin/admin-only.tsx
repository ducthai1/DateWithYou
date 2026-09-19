"use client";

import { trpc } from "@/lib/trpc";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Cổng admin dùng chung cho các trang chỉ-admin-xem.
 *
 * Nội dung ở đây không bí mật (nó là bản tóm tắt những gì đã phát hành), nên
 * cổng này là để **đỡ rối cho người dùng thường**, không phải một biên giới an
 * ninh. Thứ nào thật sự cần chặn thì phải chặn ở máy chủ bằng `adminProcedure`.
 */
export function AdminOnly({ children }: { children: React.ReactNode }) {
  const amIAdmin = trpc.blog.amIAdmin.useQuery();

  if (amIAdmin.isPending) return <Skeleton className="h-40 w-full" />;
  if (!amIAdmin.data) {
    return (
      <p className="text-muted-foreground py-16 text-center text-sm">
        Trang này dành cho quản trị viên.
      </p>
    );
  }
  return <>{children}</>;
}
