import type { Metadata } from "next";
import { AuthForm } from "@/features/auth/auth-form";
import { AuthShell } from "@/features/auth/auth-shell";

export const metadata: Metadata = {
  title: "Tạo tài khoản",
  robots: { index: false, follow: true },
};

export default function SignUpPage() {
  return (
    <AuthShell>
      <AuthForm mode="sign-up" />
    </AuthShell>
  );
}
