"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { POST_LOGIN_REDIRECT } from "@/components/layout/nav-items";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const GoogleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
    <path d="M1 1h22v22H1z" fill="none" />
  </svg>
);

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <AuthFormContent mode={mode} />
    </Suspense>
  );
}

function AuthFormContent({ mode }: { mode: "sign-in" | "sign-up" }) {
  const searchParams = useSearchParams();
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const oauthError = searchParams?.get("error");
  const isAccountExistsError = 
    oauthError === "AccountAlreadyExists" || 
    oauthError === "OAuthAccountNotLinked" ||
    oauthError?.includes("already");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = isSignUp
      ? await authClient.signUp.email({ name, email, password })
      : await authClient.signIn.email({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Có lỗi xảy ra, thử lại nhé.");
      return;
    }
    // Hard-navigate (not client-side push) so the entire React tree + Query
    // cache resets. This prevents stale space data from a previous login from
    // causing a flash of app chrome before SpaceGuard can redirect to /onboarding.
    window.location.href = POST_LOGIN_REDIRECT;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Romantic hero header */}
      <div className="relative flex flex-col items-center gap-3 py-6">
        {/* Soft glow backdrop */}
        <div
          className="pointer-events-none absolute inset-0 rounded-3xl opacity-40"
          style={{
            background:
              "radial-gradient(ellipse at 50% 60%, var(--accent-soft) 0%, transparent 70%)",
          }}
        />
        {/* Heart motif */}
        <div
          className="relative z-10 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--accent-soft)" }}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-6 w-6"
            style={{ fill: "var(--accent)" }}
            aria-hidden="true"
          >
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
        {/* Wordmark */}
        <div className="relative z-10 text-center">
          {/* Always visible now. It used to go sr-only once the brand panel
              appeared above lg, because that panel's artwork carried the
              wordmark baked into its own pixels. The panel's current artwork
              (auth-shell.tsx) is a decorative flat-lay photo with no wordmark
              in it, so this heading is the only place the name shows on that
              side of the screen at any width. */}
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              background:
                "linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-to) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Vivu No Plan
          </h1>
          <p className="mt-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isSignUp ? "Tạo tài khoản để bắt đầu hành trình" : "Chào mừng trở lại, mình nhớ bạn"}
          </p>
        </div>
      </div>

      {isAccountExistsError && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">Tài khoản đã tồn tại</p>
            <p className="text-xs text-destructive/90">
              Email này đã được đăng ký bằng mật khẩu trước đó. Vui lòng đăng nhập bằng mật khẩu bên dưới, sau đó vào <strong className="font-semibold">Cài đặt</strong> để liên kết với Google.
            </p>
          </div>
        </div>
      )}

      {/* Google sign-in */}
      <Button
        variant="outline"
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border-border bg-card font-medium text-foreground transition-all hover:border-accent/40 hover:bg-accent/5 hover:shadow-sm touch-manipulation"
        onClick={() =>
          authClient.signIn.social({
            provider: "google",
            callbackURL: POST_LOGIN_REDIRECT,
          })
        }
      >
        <GoogleIcon className="h-5 w-5 shrink-0" />
        Tiếp tục với Google
      </Button>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" /> hoặc{" "}
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignUp && (
          <Input
            label="Tên của bạn"
            autoComplete="name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <Input
          type="email"
          label="Email"
          autoComplete="email"
          name="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <div className="space-y-1">
          <Input
            type="password"
            label="Mật khẩu"
            autoComplete={isSignUp ? "new-password" : "current-password"}
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {!isSignUp && (
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="-my-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-accent transition-colors"
              >
                Quên mật khẩu?
              </Link>
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="h-11 w-full touch-manipulation"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang xử lý…
            </span>
          ) : isSignUp ? (
            "Đăng ký"
          ) : (
            "Đăng nhập"
          )}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="font-medium"
          style={{ color: "var(--accent)" }}
        >
          {isSignUp ? "Đăng nhập" : "Đăng ký"}
        </Link>
      </p>
    </div>
  );
}
