import type { Metadata } from "next";
import { NotebookScreen } from "@/features/notebook/notebook-screen";

export const metadata: Metadata = {
  title: "Sổ tay",
  robots: { index: false, follow: false },
};

export default function NotebookPage() {
  return <NotebookScreen />;
}
