import type { Metadata } from "next";
import { HomeScreen } from "@/features/home/home-screen";

export const metadata: Metadata = {
  title: "Hôm nay",
  robots: { index: false, follow: false },
};

export default function HomePage() {
  return <HomeScreen />;
}
