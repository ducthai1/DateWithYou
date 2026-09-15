import type { Metadata } from "next";
import { ErrorLogScreen } from "@/features/ops/error-log-screen";

export const metadata: Metadata = {
  title: "Lỗi máy chủ",
  robots: { index: false, follow: false },
};

export default function ErrorLogPage() {
  return <ErrorLogScreen />;
}
