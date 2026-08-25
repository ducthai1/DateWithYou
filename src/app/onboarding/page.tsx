import type { Metadata } from "next";
import { Onboarding } from "@/features/space/onboarding";

export const metadata: Metadata = {
  title: "Bắt đầu",
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <Onboarding />;
}
