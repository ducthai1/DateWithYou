"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MailCheck, AlertCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    // The redirect URL where Better Auth will send the user back after clicking the email link
    const redirectTo = `${window.location.origin}/reset-password`;

    // @ts-expect-error - requestPasswordReset might not be typed properly without the full plugin inference, but it maps to /api/auth/request-password-reset
    const { error } = await (authClient as { requestPasswordReset: (args: { email: string; redirectTo: string }) => Promise<{ error: { message: string } | null }> }).requestPasswordReset({
      email,
      redirectTo,
    });

    setLoading(false);

    if (error) {
      setError(error.message || "Có lỗi xảy ra, vui lòng thử lại.");
    } else {
      setSuccess(true);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
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
          <MailCheck
            className="h-6 w-6"
            style={{ color: "var(--accent)" }}
            aria-hidden="true"
          />
        </div>
        <div className="relative z-10 text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--foreground)",
            }}
          >
            Quên mật khẩu
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            Nhập email của bạn để nhận liên kết đặt lại mật khẩu.
          </p>
        </div>
      </div>

      {success ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-sm">
          <p className="mb-4 text-sm text-foreground">
            Chúng tôi đã gửi email khôi phục đến <br />
            <strong className="font-semibold">{email}</strong>
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            Vui lòng kiểm tra hộp thư đến (hoặc thư rác) và làm theo hướng dẫn.
          </p>
          <Link 
            href="/sign-in"
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-border bg-card px-4 text-sm font-medium shadow-sm transition-all hover:bg-muted active:scale-[.98]"
          >
            Quay lại đăng nhập
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            label="Email của bạn"
            autoComplete="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
            disabled={loading || !email}
            className="h-11 w-full touch-manipulation"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang gửi...
              </span>
            ) : (
              "Gửi liên kết khôi phục"
            )}
          </Button>
          
          <div className="text-center pt-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" /> Quay lại
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
