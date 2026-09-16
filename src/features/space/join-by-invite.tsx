"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Loader2, UserPlus, Users, XCircle } from "lucide-react";
import { StandaloneScreen } from "@/components/layout/standalone-screen";
import { ToneArt } from "@/components/theme/tone-art";
import { useToast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { inviteErrorHeadline } from "@/lib/invite-errors";

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
          /*
           * The headline, not the paragraph, and not always red.
           *
           * This screen renders the full explanation and the way forward
           * underneath — a toast carrying the same thirty words made it look
           * like the page had fired twice, which is what the expired screen
           * actually showed. And "you are already in this space" is not an
           * error; it was being announced in the same destructive red as a
           * dead code, over a green tick saying the opposite.
           */
          toast(
            inviteErrorHeadline(err.message),
            err.message === "ALREADY_MEMBER" ? "info" : "error",
          );
        },
      },
    );
  }, [sessionPending, preview.isPending, session, code, join, toast, utils]);

  const signedIn = Boolean(session?.user);

  /*
   * The warning a signed-out visitor would otherwise never see.
   *
   * The toast for a dead code rides on joinByCode's error, and joinByCode only
   * runs for somebody with a session. A person arriving from a message has no
   * account — which is the whole reason this screen exists — so the one case
   * that most needs "this link is too old, ask them for a new one" was the one
   * case that got a card and no alert at all.
   *
   * The ref makes it fire once. `preview` is a query; a refetch on window
   * focus would otherwise stack another toast every time they tabbed back.
   */
  const warned = useRef(false);
  useEffect(() => {
    if (warned.current || signedIn || preview.isPending) return;
    const status = preview.data?.status;
    if (status !== "expired" && status !== "unknown") return;
    warned.current = true;
    toast(
      inviteErrorHeadline(status === "expired" ? "EXPIRED_CODE" : "INVALID_OR_EXPIRED_CODE"),
      "error",
    );
  }, [signedIn, preview.isPending, preview.data, toast]);

  const signUpHref = `/sign-up?moi=${encodeURIComponent(code)}`;
  const signInHref = `/sign-in?moi=${encodeURIComponent(code)}`;
  const spaceName = preview.data?.spaceName;

  /*
   * ── Who gets to decide what this screen says ──────────────────────────
   *
   * Two sources answer the same question and only one of them knows who is
   * asking. `previewInvite` is a publicProcedure, so it runs with no session:
   * it can see that a space has two members, not that one of those two is the
   * person reading the screen; it can see that a code has expired, not that
   * the expired code belongs to a space they are already in.
   *
   * `joinByCode` runs as the visitor and tests membership FIRST. So for a
   * signed-in visitor its verdict is the only one worth rendering, and every
   * preview-derived branch below is gated behind being signed out.
   *
   * Getting this wrong was visible on screen: somebody re-opening their own
   * invite link was shown "Không gian đã đủ hai người" with a button to the
   * homepage, while the toast fired under it read "Bạn đã ở trong không gian
   * này rồi". Same screen, opposite sentences, and the guess won over the
   * fact.
   */
  const deadOnArrival =
    !signedIn &&
    preview.data &&
    (preview.data.status === "expired" || preview.data.status === "unknown");

  /** Expired, rather than spent or unknown — from whichever source may speak. */
  const expired = signedIn
    ? state === "failed" && reason === "EXPIRED_CODE"
    : preview.data?.status === "expired";

  /** A signed-out visitor is definitionally not a member, so here it is safe. */
  const full = signedIn
    ? state === "failed" && reason === "SPACE_FULL"
    : preview.data?.status === "full";

  if (preview.isPending || sessionPending) {
    return (
      <StandaloneScreen>
        <Loader2 className="text-accent h-8 w-8 animate-spin" />
      </StandaloneScreen>
    );
  }

  if (deadOnArrival || (state === "failed" && isDeadReason(reason))) {
    return (
      <StandaloneScreen>
        <Outcome
          tone="warn"
          icon={<Clock className="h-7 w-7" />}
          title={expired ? "Lời mời đã hết hạn" : "Lời mời không còn dùng được"}
          body={
            expired
              ? "Lời mời chỉ có hiệu lực 7 ngày. Nhờ người kia mở Cài đặt → Mời người đồng hành và tạo lời mời mới giúp bạn nhé."
              : "Có thể mã đã được dùng rồi, hoặc đã bị thay bằng mã mới. Nhờ người kia tạo lời mời mới giúp bạn nhé."
          }
          action={{ href: "/home", label: "Về trang chủ" }}
        />
      </StandaloneScreen>
    );
  }

  if (state === "failed" && reason === "ALREADY_MEMBER") {
    return (
      <StandaloneScreen>
        <Outcome
          tone="ok"
          icon={<CheckCircle2 className="h-7 w-7" />}
          title="Bạn đã ở trong không gian này rồi"
          body="Không cần làm gì thêm — mở ứng dụng lên là thấy nhau thôi."
          action={{ href: "/home", label: "Mở ứng dụng" }}
        />
      </StandaloneScreen>
    );
  }

  if (full) {
    return (
      <StandaloneScreen>
        <Outcome
          tone="warn"
          icon={<Users className="h-7 w-7" />}
          title="Không gian đã đủ hai người"
          body="Mỗi không gian hiện chỉ dành cho hai người. Nếu bạn nghĩ có nhầm lẫn, nhắn lại cho người đã mời bạn nhé."
          action={{ href: "/home", label: "Về trang chủ" }}
        />
      </StandaloneScreen>
    );
  }

  if (state === "joined") {
    return (
      <StandaloneScreen>
        <Outcome
          tone="ok"
          icon={<CheckCircle2 className="h-7 w-7" />}
          title="Xong rồi!"
          body={spaceName ? `Bạn và người kia giờ chung “${spaceName}”.` : "Hai người giờ đã chung một không gian."}
        />
      </StandaloneScreen>
    );
  }

  if (state === "failed") {
    return (
      <StandaloneScreen>
        <Outcome
          tone="bad"
          icon={<XCircle className="h-7 w-7" />}
          title="Chưa vào được"
          body="Có gì đó không ổn khi nhận lời mời. Thử lại, hoặc nhờ người kia tạo lời mời mới."
          action={{ href: "/home", label: "Về trang chủ" }}
        />
      </StandaloneScreen>
    );
  }

  /* ── Signed out: say whose space it is, THEN ask them to sign up ──── */
  if (!signedIn) {
    return (
      <StandaloneScreen>
        <div className="w-full space-y-6 text-center">
          {/* `priority` because this is the LCP element of the one screen a
              stranger sees before deciding whether to make an account — Next
              said so in dev, and lazily loading it means the invitation opens
              as an empty box with a name under it. */}
          <ToneArt name="bannerOurPage" alt="" priority className="mx-auto max-w-[13rem]" />
          <div className="space-y-2">
            {/* An eyebrow, not a sentence: it labels the name below it, and at
                this size a second line of ordinary grey body copy above the
                headline just reads as more paragraph. */}
            <p className="text-muted-foreground text-[0.6875rem] font-semibold uppercase tracking-[0.14em]">
              Bạn được mời vào
            </p>
            {/*
              A space name is whatever its owner typed, up to 60 characters,
              and nothing makes them use a space — "Khônggianchungcủahaiđứa…"
              is a legal name. With no wrapping rule at all it simply paints
              outside this box and stretches the document: measured 459px of
              sideways scroll at 390px wide and 101px at 1280, and the e2e goes
              red on four checks.

              `break-words` also fixes it here, because the panel's width is
              already pinned by `w-full max-w-md` so min-content never gets a
              vote. `anywhere` is kept because it is the value that ALSO holds
              if this box ever becomes auto-width, and it costs nothing today.
            */}
            <h1 className="wrap-anywhere text-2xl font-bold leading-tight text-balance sm:text-[1.75rem]">
              {spaceName ? `“${spaceName}”` : "một không gian chung"}
            </h1>
            <p className="text-muted-foreground mx-auto max-w-[22rem] text-pretty text-sm leading-relaxed">
              Nơi hai người lưu chỗ đã đi, lên kế hoạch và giữ lại kỷ niệm — miễn phí, không cần tải ứng dụng.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Link
              href={signUpHref}
              className="btn-sheen bg-accent text-accent-foreground hover:bg-accent-hover inline-flex h-14 w-full items-center justify-center rounded-xl text-base font-medium shadow-sm transition-colors"
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
          <p className="text-muted-foreground text-pretty text-xs">
            Lời mời này dùng được một lần và hết hạn sau 7 ngày.
          </p>
        </div>
      </StandaloneScreen>
    );
  }

  return <StandaloneScreen><Loader2 className="text-accent h-8 w-8 animate-spin" /></StandaloneScreen>;
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
  /* The halo is what says "good news" or "nothing you did wrong" before a
     word is read, so it carries a ring as well as a fill — at 16px of icon on
     a white card a flat tint is too quiet to register as a signal. */
  const ring =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-700 ring-emerald-500/20"
      : tone === "warn"
        ? "bg-amber-50 text-amber-700 ring-amber-500/25"
        : "bg-destructive-soft text-destructive ring-destructive/20";
  return (
    <>
      <span
        className={`flex h-16 w-16 items-center justify-center rounded-2xl ring-1 ${ring}`}
      >
        {icon}
      </span>
      <div className="space-y-2">
        {/* balance so a title does not drop its last word onto a line alone —
            "Bạn đã ở trong không gian này rồi" was breaking after "này". */}
        <h1 className="text-xl font-bold leading-tight text-balance sm:text-2xl">{title}</h1>
        {/* Carries the space name on the success screen, so same rule. */}
        <p className="text-muted-foreground wrap-anywhere text-pretty text-sm leading-relaxed">{body}</p>
      </div>
      {action && (
        // Same classes as Button's `outline`, rather than a fourth hand-rolled
        // copy of them — this is a Link, so it cannot be the Button itself.
        <Link
          href={action.href}
          className="border-border bg-card hover:bg-muted inline-flex h-12 w-full items-center justify-center rounded-xl border text-sm font-medium shadow-sm transition-colors"
        >
          {action.label}
        </Link>
      )}
    </>
  );
}
