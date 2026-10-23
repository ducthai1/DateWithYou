"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadFailed } from "@/components/ui/load-failed";
import { ConfirmButton } from "@/components/ui/confirm-button";
import { trpc } from "@/lib/trpc";
import { useQueryString, replaceQuery } from "@/hooks/use-query-state";
import { useAppReady } from "@/components/layout/boot-veil-dismiss";
import { Card } from "@/components/ui/card";
import { NOTEBOOK_LIMITS, dayMonth } from "@/lib/notebook";
import { NotebookBody } from "./notebook-body";
import { NotebookCreateForm } from "./notebook-create-form";
import { NotebookTextPrompt } from "./notebook-text-prompt";

/**
 * Sổ tay: notes plus a day-by-day plan, one notebook at a time.
 *
 * One route, not /so-tay/[id]: the notebook on screen is `?so=<id>`, so a
 * reload and a shared link land on it, and there is no dynamic segment to
 * remount on every switch. With no `?so`, the most recently touched one opens.
 */
export function NotebookScreen() {
  const list = trpc.notebook.list.useQuery();
  // Tấm khởi động đợi màn này: mở app đúng ở đây thì không được gỡ tấm che
  // trong lúc còn khung xương. Báo cả khi lỗi — thẻ "thử lại" hơn là màn navy.
  useAppReady(!list.isPending);
  const [param, setParam] = useQueryString("so");
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const utils = trpc.useUtils();
  const rename = trpc.notebook.rename.useMutation({ onSuccess: () => void utils.notebook.invalidate() });
  const remove = trpc.notebook.remove.useMutation({
    onSuccess: () => {
      replaceQuery({ so: null, muc: null });
      void utils.notebook.list.invalidate();
    },
  });

  const books = list.data ?? [];
  const current = books.find((b) => b.id === param) ?? books[0];

  return (
    <PageShell
      className="space-y-4"
      header={
        <PageHeader
          title="Sổ tay"
          subtitle="Ghi chú và lịch theo từng ngày của hai bạn: hôm nay làm gì, cả đợt ra sao, đã tới mốc nào."
          art="tripPlanner"
          actions={
            <>
              {books.length > 1 && (
                <div className="w-full sm:w-56">
                  <Select
                    value={current?.id ?? ""}
                    onChange={(v) => replaceQuery({ so: v, muc: null })}
                    options={books.map((b) => ({ value: b.id, label: b.title }))}
                    placeholder="Chọn sổ"
                  />
                </div>
              )}
              <Button onClick={() => setCreating(true)}>+ Sổ mới</Button>
            </>
          }
        />
      }
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
        <>
          {/* On a card, not on the artwork: text straight on the backdrop sank into it. */}
          <Card className="flex items-start gap-1 p-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold leading-snug wrap-anywhere">{current.title}</h2>
              {current.start && current.end && (
                <p className="text-muted-foreground text-sm">
                  {dayMonth(current.start)} – {dayMonth(current.end)} · {current.dayCount} ngày
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" aria-label="Đổi tên sổ" className="h-10 w-10" onClick={() => setRenaming(true)}>
              <Pencil className="h-4 w-4" />
            </Button>
            {/* Icon only until tapped: deleting a whole plan is rare, and a red
                word at the top of the page shouted louder than the plan itself. */}
            <ConfirmButton
              idle=""
              icon={<Trash2 className="h-4 w-4" />}
              aria-label="Xoá sổ"
              title="Xoá sổ này?"
              description="Cả lịch, các mục ghi chú và số cân trong sổ sẽ mất, không lấy lại được."
              confirmText="Xoá sổ"
              className="h-10 w-10 justify-center rounded-lg hover:no-underline"
              onConfirm={() => remove.mutate({ id: current.id })}
            />
          </Card>
          <NotebookBody key={current.id} id={current.id} />
        </>
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
      {renaming && current && (
        <NotebookTextPrompt
          title="Đổi tên sổ"
          label="Tên sổ"
          initial={current.title}
          maxLength={NOTEBOOK_LIMITS.title}
          onSave={(title) => rename.mutate({ id: current.id, title })}
          onClose={() => setRenaming(false)}
        />
      )}
    </PageShell>
  );
}
