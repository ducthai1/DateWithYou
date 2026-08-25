import type { Metadata } from "next";
import { FoodWheel } from "@/features/wheel/food-wheel";

export const metadata: Metadata = {
  title: "Vòng quay",
  robots: { index: false, follow: false },
};

export default function WheelPage() {
  return <FoodWheel />;
}
