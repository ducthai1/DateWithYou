"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Link2, Loader2, AlertCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { ToneArt } from "@/components/theme/tone-art";

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
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
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

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-10 px-6 lg:max-w-5xl lg:flex-row lg:items-center lg:gap-16 lg:px-10">
      {/*
        Artwork column — lg+ only. Below lg there is no width to spare for a
        second column, so the small inline picture inside the header (further
        down) carries the same job on its own instead of duplicating it here.
      */}
      <div className="hidden w-full max-w-md items-center justify-center lg:flex">
        {/* Same short-viewport swap as the header's inline picture: hidden
            below 760px of height in favour of a heart motif, for the same
            reason — a laptop in landscape has no room to spare for a picture
            this tall without pushing the form off-screen. */}
        <div className="w-full short:hidden">
          <ToneArt name="mapTreasure" sizes="480px"   framed
            />
        </div>
        <div
          className="hidden h-16 w-16 items-center justify-center rounded-2xl short:flex"
          style={{ background: "var(--accent-soft)" }}
        >
          <Heart
            className="h-8 w-8"
            style={{ fill: "var(--accent)", color: "var(--accent)" }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Form column. */}
      <div className="flex w-full flex-col gap-6 lg:max-w-sm lg:shrink-0">
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

          {/*
            The picture, on the one screen that has nothing else to show. This is
            the first thing after sign-up: there is no content yet, so a 48px
            heart in a rounded square was the entire visual argument for opening
            an account.

            Hidden below 760px of viewport height rather than shrunk. This column
            is centred inside min-h-dvh with a form under it; on a laptop in
            landscape the picture is what pushes the submit button off-screen, and
            a picture nobody can reach the button past is worse than no picture.
            The heart motif comes back in its place so the header never collapses
            to bare text.

            Also hidden at lg+ regardless of height: the dedicated artwork column
            to the left carries this job at that width, so showing both would be
            the same picture (or the same heart) twice on one screen.
          */}
          <div className="relative z-10 w-full overflow-hidden rounded-2xl border border-border/60 shadow-sm short:hidden lg:hidden">
            <ToneArt name="mapTreasure" sizes="384px" />
          </div>

          {/* Heart motif — the short-viewport stand-in for the artwork above. */}
          <div
            className="relative z-10 hidden h-12 w-12 items-center justify-center rounded-2xl short:flex lg:hidden"
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
              Không gian của riêng mình
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Một góc riêng của bạn — muốn thì rủ thêm một người.
            </p>
          </div>
        </div>

        {/* Progress hint */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{tab === "create" ? `Bước ${createStep}/2` : "Bước 1/1"}</span>
            <span>{tab === "create" ? (createStep === 1 ? "Tạo không gian" : "Mã bảo vệ") : "Vào bằng mã mời"}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-accent/15">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "var(--accent)" }}
              animate={{ width: tab === "create" ? (createStep === 1 ? "50%" : "100%") : "100%" }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
            />
          </div>
        </div>

        <Tabs 
          tabs={ONBOARDING_TABS} 
          value={tab} 
          onChange={(val) => {
            setTab(val);
            if (val === "create") setCreateStep(1);
          }} 
        />

        <div className="relative">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={tab === "create" ? `create-${createStep}` : "join"}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--accent)" }}>
                        <Heart className="h-3.5 w-3.5" style={{ fill: "var(--accent)", color: "var(--accent)" }} />
                        {createStep === 1 ? "Tên không gian của tụi mình" : "Mật khẩu không gian"}
                      </div>
                      {createStep === 2 && (
                        <button onClick={() => setCreateStep(1)} className="text-xs text-muted-foreground hover:text-foreground">
                          Quay lại
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {createStep === 1 ? (
                    <>
                      <Input
                        label="Tên không gian (vd: Vivu No Plan)"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && name.trim()) setCreateStep(2);
                        }}
                      />
                      <Button
                        className="h-11 w-full touch-manipulation mt-1"
                        disabled={!name.trim()}
                        onClick={() => setCreateStep(2)}
                      >
                        Tiếp tục
                      </Button>
                    </>
                  ) : (
                    <>
                      <Input
                        label="Mã PIN xoá không gian (tuỳ chọn)"
                        type="password"
                        value={pin}
                        onChange={(e) => setPin(e.target.value)}
                      />
                      <p className="-mt-1 px-1 text-xs text-muted-foreground">
                        Đặt mã PIN nếu muốn cần mã để xoá không gian sau này. Bỏ trống
                        cũng được — khi đó xoá sẽ cần gõ đúng tên không gian.
                      </p>
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
                        className="h-11 w-full touch-manipulation mt-1"
                        disabled={create.isPending}
                        onClick={() => create.mutate({ name: name.trim(), pin: pin.trim() || undefined })}
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
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: "var(--accent)" }}>
                      <Link2 className="h-3.5 w-3.5" />
                      Vào không gian có sẵn
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
                    className="h-11 w-full touch-manipulation mt-1"
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
    </div>
  );
}
