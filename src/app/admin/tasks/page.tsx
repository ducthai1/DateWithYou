import type { Metadata } from "next";
import { TaskList } from "@/features/admin/task-list";
import { PageShell } from "@/components/layout/page-shell";

export const metadata: Metadata = { title: "Việc đang chờ", robots: { index: false, follow: false } };

export default function AdminTasksPage() {
  return (
    <PageShell header={<h1 className="text-h1 font-semibold">Việc đang chờ</h1>}>
      <TaskList />
    </PageShell>
  );
}
