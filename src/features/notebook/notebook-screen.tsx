"use client";

import { useState } from "react";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadFailed } from "@/components/ui/load-failed";
import { trpc } from "@/lib/trpc";
import { useQueryString, replaceQuery } from "@/hooks/use-query-state";
import { useAppReady } from "@/components/layout/boot-veil-dismiss";
import { NotebookBody } from "./notebook-body";
import { NotebookCreateForm } from "./notebook-create-form";

/**
 * Sổ tay: notes plus a day-by-day plan, one notebook at a time.
 *
 * One route, not /so-tay/[id]: the notebook on screen is `?so=<id>`, so a
 * reload and a shared link land on it, and there is no dynamic segment to
 * remount on every switch. With no `?so`, the most recently touched one opens.
 *
 * The page header is a title and one short line, nothing else. It does not
 * scroll, and with a three-line description and its own row for "+ Sổ mới" it
 * held a quarter of a phone screen; the notebook's own bar below carries the
 * picker and the buttons.
 */
export function NotebookScreen() {
  const list = trpc.notebook.list.useQuery();
  // Tấm khởi động đợi màn này: mở app đúng ở đây thì không được gỡ tấm che
  // trong lúc còn khung xương. Báo cả khi lỗi — thẻ "thử lại" hơn là màn navy.
  useAppReady(!list.isPending);
  const [param, setParam] = useQueryString("so");
  const [creating, setCreating] = useState(false);
  const utils = trpc.useUtils();
  const remove = trpc.notebook.remove.useMutation({
    onSuccess: () => {
      replaceQuery({ so: null, muc: null, ngay: null });
      void utils.notebook.list.invalidate();
    },
  });

  const books = list.data ?? [];
  const current = books.find((b) => b.id === param) ?? books[0];

  return (
    <PageShell
      className="space-y-4"
      header={<PageHeader title="Sổ tay" subtitle="Lịch, ghi chú và mốc của hai bạn." art="tripPlanner" />}
    >
      {list.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : list.isError ? (
        <LoadFailed what="sổ tay" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : !current ? (
        <EmptyState
          icon="calendar-days"
          art="tripPlanner"
          title="Chưa có sổ nào"
          subtitle="Tạo một sổ để ghi lịch ăn, lịch tập hay bất cứ kế hoạch nào theo từng ngày."
          action={{ label: "+ Tạo sổ đầu tiên", onClick: () => setCreating(true) }}
        />
      ) : (
        <NotebookBody
          key={current.id}
          id={current.id}
          onNew={() => setCreating(true)}
          onRemove={() => remove.mutate({ id: current.id })}
          switcher={
            books.length > 1 ? (
              <Select
                value={current.id}
                onChange={(v) => replaceQuery({ so: v, muc: null, ngay: null })}
                options={books.map((b) => ({ value: b.id, label: b.title }))}
                placeholder="Chọn sổ"
              />
            ) : undefined
          }
        />
      )}

      {creating && (
        <NotebookCreateForm
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setParam(id);
          }}
        />
      )}
    </PageShell>
  );
}
