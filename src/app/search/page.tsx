import type { Metadata } from "next";
import { SearchScreen } from "@/features/search/search-screen";

export const metadata: Metadata = {
  title: "Tìm kiếm",
  robots: { index: false, follow: false },
};

export default function SearchPage() {
  return <SearchScreen />;
}
