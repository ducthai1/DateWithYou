"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { KeyRound, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AuthShell } from "@/features/auth/auth-shell";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex h-dvh items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");
  
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    if (password.length < 6) {
      setError("Mật khẩu phải có ít nhất 6 ký tự.");
      return;
    }

    setLoading(true);

    const { error } = await authClient.resetPassword({
      newPassword: password,
      // Better Auth usually auto-detects token from URL, but passing it explicitly is safer
      token: token || undefined, 
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Link đã hết hạn hoặc không hợp lệ.");
    } else {
      setSuccess(true);
    }
  }

  if (!token && !success) {
    return (
      <AuthShell>
      <div className="flex flex-col gap-4 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold">Liên kết không hợp lệ</h1>
        <p className="text-sm text-muted-foreground">
          Vui lòng kiểm tra lại đường dẫn trong email khôi phục của bạn.
        </p>
        <Link 
          href="/forgot-password"
          className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:bg-accent/90 active:scale-[.98]"
        >
          Yêu cầu liên kết mới
        </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-6">
      <div className="relative flex flex-col items-center gap-3 py-6">
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, var(--accent-soft) 0%, transparent 70%)",
          }}
        />
        <div
          className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)" }}
        >
          {success ? (
            <CheckCircle2 className="h-6 w-6 text-green-500" />
          ) : (
            <KeyRound
              className="h-6 w-6"
              style={{ color: "var(--accent)" }}
              aria-hidden="true"
            />
          )}
        </div>
        <div className="relative z-10 text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--foreground)",
            }}
          >
            {success ? "Thành công" : "Tạo mật khẩu mới"}
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {success
              ? "Mật khẩu của bạn đã được đặt lại thành công."
              : "Vui lòng nhập mật khẩu mới cho tài khoản của bạn."}
          </p>
        </div>
      </div>

      {success ? (
        <Link 
          href="/sign-in"
          className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent px-4 text-sm font-medium text-accent-foreground shadow-sm transition-all hover:bg-accent/90 active:scale-[.98]"
        >
          Đến trang Đăng nhập
        </Link>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            label="Mật khẩu mới"
            autoComplete="new-password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          
          <Input
            type="password"
            label="Xác nhận mật khẩu"
            autoComplete="new-password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            className="h-11 w-full touch-manipulation"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </span>
            ) : (
              "Lưu mật khẩu mới"
            )}
          </Button>
        </form>
      )}
      </div>
    </AuthShell>
  );
}
