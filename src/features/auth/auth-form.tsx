"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const isSignUp = mode === "sign-up";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    router.push("/onboarding");
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold">Chuyện của Cá</h1>
        <p className="text-muted-foreground text-sm">
          {isSignUp ? "Tạo tài khoản để bắt đầu" : "Đăng nhập để tiếp tục"}
        </p>
      </div>

      <Button
        variant="outline"
        onClick={() =>
          authClient.signIn.social({ provider: "google", callbackURL: "/onboarding" })
        }
      >
        Tiếp tục với Google
      </Button>

      <div className="text-muted-foreground flex items-center gap-3 text-xs">
        <span className="bg-border h-px flex-1" /> hoặc{" "}
        <span className="bg-border h-px flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {isSignUp && (
          <Input
            placeholder="Tên của bạn"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        )}
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Mật khẩu"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Đang xử lý…" : isSignUp ? "Đăng ký" : "Đăng nhập"}
        </Button>
      </form>

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? "Đã có tài khoản? " : "Chưa có tài khoản? "}
        <Link
          href={isSignUp ? "/sign-in" : "/sign-up"}
          className="text-accent font-medium"
        >
          {isSignUp ? "Đăng nhập" : "Đăng ký"}
        </Link>
      </p>
    </div>
  );
}
