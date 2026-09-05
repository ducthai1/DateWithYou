import type { Metadata } from "next";
import { BlogSearch } from "@/features/blog/blog-search";

// A per-query, interactive page — keep it out of search indexes.
export const metadata: Metadata = { title: "Tìm bài viết — Blog", robots: { index: false, follow: false } };

export default function BlogSearchPage() {
  return <BlogSearch />;
}
