import type { Metadata } from "next";
import { BlogAdminList } from "@/features/blog/admin/admin-list";

// Admin is private; keep it out of search entirely.
export const metadata: Metadata = { title: "Quản lý blog", robots: { index: false, follow: false } };

export default function AdminBlogPage() {
  return <BlogAdminList />;
}
