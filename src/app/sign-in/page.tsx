import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Đăng nhập",
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return <AuthForm mode="sign-in" />;
}
