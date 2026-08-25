import type { Metadata } from "next";
import { LibraryPage } from "@/features/library/library-page";

export const metadata: Metadata = {
  title: "Bộ sưu tập",
  robots: { index: false, follow: false },
};

export default function Library() {
  return <LibraryPage />;
}
