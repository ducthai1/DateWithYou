"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Link2, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";

const ONBOARDING_TABS = [
  { key: "create", label: "Tạo mới" },
  { key: "join", label: "Tham gia" },
] as const;

function ErrorCard({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <p className="text-sm text-destructive">{message}</p>
    </div>
  );
}

export function Onboarding() {
  const router = useRouter();
  const mine = trpc.space.getMine.useQuery();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  // Enter the freshly created/joined space. We set the active-space cookie and do
  // a FULL navigation (not router.replace) on purpose: a client-side replace keeps
  // the React Query cache, where `space.getMine` is still the stale "no space"
  // result fetched on this page (fresh for staleTime). The space guard + settings
  // page would then read that stale null and bounce the user straight back here —
  // the "stuck on step 2" loop. A full load starts a clean cache that refetches
  // getMine and sees the new space. Mirrors space-settings' handleSpaceSwitch.
  function enterSpace(id: string) {
    const maxAge = 60 * 60 * 24 * 365;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `active_space_id=${id}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
    window.location.assign("/settings");
  }

  const create = trpc.space.create.useMutation({
    onSuccess: (d) => enterSpace(d.id),
  });
  const join = trpc.space.joinByCode.useMutation({
    onSuccess: (d) => enterSpace(d.id),
  });

  // Already in a space → skip onboarding.
  useEffect(() => {
    if (mine.data) router.replace("/settings");
  }, [mine.data, router]);

  if (mine.isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const step = tab === "create" ? 1 : 2;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
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
          <Heart
            className="h-6 w-6"
            style={{ fill: "var(--accent)", color: "var(--accent)" }}
            aria-hidden="true"
          />
        </div>

        {/* Wordmark */}
        <div className="relative z-10 text-center">
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              background:
                "linear-gradient(135deg, var(--gradient-from) 0%, var(--gradient-to) 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            Không gian của tụi mình
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Bắt đầu hành trình cùng người ấy — chỉ hai người thôi.
          </p>
        </div>
      </div>

      {/* Progress hint */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Bước {step}/2</span>
          <span>{tab === "create" ? "Tạo không gian" : "Ghép đôi với người ấy"}</span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-accent/15">
          <motion.div
            className="h-full rounded-full"
            style={{ background: "var(--accent)" }}
            animate={{ width: tab === "create" ? "50%" : "100%" }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        </div>
      </div>

      <Tabs tabs={ONBOARDING_TABS} value={tab} onChange={setTab} />

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              y: -10,
              filter: "blur(4px)",
              position: "absolute",
              width: "100%",
              top: 0,
              left: 0,
            }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {tab === "create" ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--accent)" }}>
                    <Heart className="h-3.5 w-3.5" style={{ fill: "var(--accent)", color: "var(--accent)" }} />
                    Tạo không gian của tụi mình
                  </div>
                </div>
                <Input
                  label="Tên không gian (vd: Vivu No Plan)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {create.error && (
                  <ErrorCard
                    message={
                      create.error.message === "ALREADY_IN_SPACE"
                        ? "Bạn đã có không gian rồi."
                        : `Không tạo được: ${create.error.message}`
                    }
                  />
                )}
                <Button
                  className="h-11 w-full touch-manipulation"
                  disabled={!name.trim() || create.isPending}
                  onClick={() => create.mutate({ name: name.trim() })}
                >
                  {create.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tạo…
                    </span>
                  ) : (
                    "Tạo không gian"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--accent)" }}>
                    <Link2 className="h-3.5 w-3.5" />
                    Ghép đôi với người ấy
                  </div>
                </div>
                <Input
                  label="Nhập mã mời"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
                {join.error && (
                  <ErrorCard
                    message={
                      join.error.message === "INVALID_OR_EXPIRED_CODE"
                        ? "Mã sai hoặc đã hết hạn."
                        : join.error.message === "ALREADY_IN_SPACE"
                          ? "Bạn đã có không gian rồi."
                          : "Không tham gia được, thử lại nhé."
                    }
                  />
                )}
                <Button
                  className="h-11 w-full touch-manipulation"
                  disabled={!code.trim() || join.isPending}
                  onClick={() => join.mutate({ code: code.trim() })}
                >
                  {join.isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang kết nối…
                    </span>
                  ) : (
                    "Tham gia"
                  )}
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
