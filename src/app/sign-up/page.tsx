import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata: Metadata = {
  title: "Tạo tài khoản",
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return <AuthForm mode="sign-up" />;
}
