"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, UserPlus, Users, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ToneArt } from "@/components/theme/tone-art";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { inviteErrorMessage } from "@/lib/invite-errors";

/**
 * Opening somebody's invite link.
 *
 * Five ways this ends, and the whole point of the screen is that each one says
 * which it is. The old flow had one message for all of them — "mã không hợp lệ
 * hoặc đã hết hạn" — which is wrong for three of the five and sends people to
 * ask for a new code that would not have helped.
 *
 *   signed in, code good      → join, then straight into the space
 *   signed in, already there  → say so, offer the way in
 *   signed in, space full     → say so; a third person cannot join
 *   code expired or spent     → say so, and say to ask for a new one
 *   not signed in             → show WHOSE space it is, then sign up
 *
 * The last one matters most. Somebody arriving from a message has no account
 * and no idea what this app is; showing them a login wall with no context is
 * where invitations die. So the space's name is fetched without a session —
 * that is all `previewInvite` returns, and it cannot be used to join.
 */

/** Where the code waits while somebody makes an account. */
const PENDING_KEY = "vivu.pendingInvite";

export function JoinByInvite({ code }: { code: string }) {
  const toast = useToast();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const preview = trpc.space.previewInvite.useQuery({ code }, { retry: false });
  const utils = trpc.useUtils();

  const [state, setState] = useState<"working" | "joined" | "failed">("working");
  const [reason, setReason] = useState<string | null>(null);
  const attempted = useRef(false);

  const join = trpc.space.joinByCode.useMutation();

  useEffect(() => {
    if (sessionPending || preview.isPending) return;
    if (attempted.current) return;

    // Not signed in: keep the code and send them to make an account. It is
    // picked up again on the way back, by the same key.
    if (!session?.user) {
      try {
        sessionStorage.setItem(PENDING_KEY, code);
      } catch {
        /* Private mode: the code is still in the URL we are returning to. */
      }
      return;
    }

    attempted.current = true;
    join.mutate(
      { code },
      {
        onSuccess: ({ id }) => {
          /*
           * Point the app at the space they just joined before navigating.
           *
           * Everything is scoped by the active_space_id cookie, and a new
           * member already has a personal space of their own — without this
           * they would land in that one and see an empty app, which looks
           * exactly like the invite not having worked.
           */
          const secure = location.protocol === "https:" ? "; Secure" : "";
          document.cookie = `active_space_id=${id}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax${secure}`;
          setState("joined");
          toast("Vào không gian chung rồi nhé ✨", "success");
          void utils.invalidate();
          // A hard navigation, for the same reason signing in uses one: the
          // whole React tree and query cache have to forget the old space.
          setTimeout(() => {
            window.location.href = "/home";
          }, 900);
        },
        onError: (err) => {
          setState("failed");
          setReason(err.message);
          toast(inviteErrorMessage(err.message), "error");
        },
      },
    );
  }, [sessionPending, preview.isPending, session, code, join, toast, utils]);

  const signUpHref = `/sign-up?moi=${encodeURIComponent(code)}`;
  const signInHref = `/sign-in?moi=${encodeURIComponent(code)}`;
  const spaceName = preview.data?.spaceName;

  /* ── The code is already dead before anybody tries ────────────────── */
  const deadOnArrival =
    preview.data && (preview.data.status === "expired" || preview.data.status === "unknown");
  const full = preview.data?.status === "full";

  if (preview.isPending || sessionPending) {
    return <Shell><Loader2 className="text-accent h-8 w-8 animate-spin" /></Shell>;
  }

  if (deadOnArrival || (state === "failed" && isDeadReason(reason))) {
    return (
      <Shell>
        <Outcome
          tone="warn"
          icon={<Clock className="h-7 w-7" />}
          title={preview.data?.status === "expired" ? "Lời mời đã hết hạn" : "Lời mời không còn dùng được"}
          body={
            preview.data?.status === "expired"
              ? "Lời mời chỉ có hiệu lực 7 ngày. Nhờ người kia mở Cài đặt → Mời người đồng hành và tạo lời mời mới giúp bạn nhé."
              : "Có thể mã đã được dùng rồi, hoặc đã bị thay bằng mã mới. Nhờ người kia tạo lời mời mới giúp bạn nhé."
          }
          action={{ href: "/home", label: "Về trang chủ" }}
        />
      </Shell>
    );
  }

  if (full || (state === "failed" && reason === "SPACE_FULL")) {
    return (
      <Shell>
        <Outcome
          tone="warn"
          icon={<Users className="h-7 w-7" />}
          title="Không gian đã đủ hai người"
          body="Mỗi không gian hiện chỉ dành cho hai người. Nếu bạn nghĩ có nhầm lẫn, nhắn lại cho người đã mời bạn nhé."
          action={{ href: "/home", label: "Về trang chủ" }}
        />
      </Shell>
    );
  }

  if (state === "failed" && reason === "ALREADY_MEMBER") {
    return (
      <Shell>
        <Outcome
          tone="ok"
          icon={<CheckCircle2 className="h-7 w-7" />}
          title="Bạn đã ở trong không gian này rồi"
          body="Không cần làm gì thêm — mở ứng dụng lên là thấy nhau thôi."
          action={{ href: "/home", label: "Mở ứng dụng" }}
        />
      </Shell>
    );
  }

  if (state === "joined") {
    return (
      <Shell>
        <Outcome
          tone="ok"
          icon={<CheckCircle2 className="h-7 w-7" />}
          title="Xong rồi!"
          body={spaceName ? `Bạn và người kia giờ chung “${spaceName}”.` : "Hai người giờ đã chung một không gian."}
        />
      </Shell>
    );
  }

  if (state === "failed") {
    return (
      <Shell>
        <Outcome
          tone="bad"
          icon={<XCircle className="h-7 w-7" />}
          title="Chưa vào được"
          body="Có gì đó không ổn khi nhận lời mời. Thử lại, hoặc nhờ người kia tạo lời mời mới."
          action={{ href: "/home", label: "Về trang chủ" }}
        />
      </Shell>
    );
  }

  /* ── Signed out: say whose space it is, THEN ask them to sign up ──── */
  if (!session?.user) {
    return (
      <Shell>
        <div className="w-full space-y-5 text-center">
          <ToneArt name="bannerOurPage" alt="" className="mx-auto max-w-[12rem]" />
          <div className="space-y-1.5">
            <p className="text-muted-foreground text-sm">Bạn được mời vào</p>
            <h1 className="text-2xl font-bold leading-tight">
              {spaceName ? `“${spaceName}”` : "một không gian chung"}
            </h1>
            <p className="text-muted-foreground text-sm">
              Nơi hai người lưu chỗ đã đi, lên kế hoạch và giữ lại kỷ niệm — miễn phí, không cần tải ứng dụng.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={signUpHref}
              className="bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-medium transition-colors"
            >
              <UserPlus className="mr-2 h-4 w-4" /> Tạo tài khoản để vào
            </Link>
            <Link
              href={signInHref}
              className="text-muted-foreground hover:text-accent px-4 py-3 text-sm underline underline-offset-4"
              style={{ minHeight: 44 }}
            >
              Đã có tài khoản? Đăng nhập
            </Link>
          </div>
          <p className="text-muted-foreground text-xs">
            Lời mời này dùng được một lần và hết hạn sau 7 ngày.
          </p>
        </div>
      </Shell>
    );
  }

  return <Shell><Loader2 className="text-accent h-8 w-8 animate-spin" /></Shell>;
}

/*
 * Codes that mean "ask for a new one", whichever layer reported them.
 *
 * Only the branch stays here. The words for each failure live in
 * src/lib/invite-errors.ts, because three screens can refuse an invitation —
 * this page, the code box in onboarding, and the one in settings — and the
 * three had already drifted: two of them answered "thử lại nhé" to a full
 * space, which is advice that can never work.
 */
function isDeadReason(reason: string | null): boolean {
  return reason === "EXPIRED_CODE" || reason === "INVALID_OR_EXPIRED_CODE";
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
      <Card className="flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">{children}</Card>
    </main>
  );
}

function Outcome({
  tone,
  icon,
  title,
  body,
  action,
}: {
  tone: "ok" | "warn" | "bad";
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: { href: string; label: string };
}) {
  const ring =
    tone === "ok"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "warn"
        ? "bg-amber-100 text-amber-700"
        : "bg-destructive-soft text-destructive";
  return (
    <>
      <span className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ring}`}>{icon}</span>
      <div className="space-y-1.5">
        <h1 className="text-xl font-bold leading-tight">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      </div>
      {action && (
        <Link
          href={action.href}
          className="border-border hover:bg-muted inline-flex h-11 w-full items-center justify-center rounded-xl border text-sm font-medium transition-colors"
        >
          {action.label}
        </Link>
      )}
    </>
  );
}
