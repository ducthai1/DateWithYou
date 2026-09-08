import type { Metadata } from "next";
import { BlogAdminList } from "@/features/blog/admin/admin-list";

// Admin is private; keep it out of search entirely.
export const metadata: Metadata = { title: "Quản lý blog", robots: { index: false, follow: false } };

export default function AdminBlogPage() {
  // Fills the app frame so the list inside can own the scrolling.
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <BlogAdminList />
    </div>
  );
}
