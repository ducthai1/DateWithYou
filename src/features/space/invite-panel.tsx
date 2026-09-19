"use client";

import { useState } from "react";
import { Check, Copy, Link2, QrCode, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { InviteQr } from "./invite-qr";

/**
 * Inviting the other person.
 *
 * What was here was a ten-character code from a confusable alphabet, shown on
 * one phone to be typed into another. It works, and nobody wants to do it. So
 * the code is still there — it is the same single-use code, and somebody
 * across a table can still read it out — but the two ways people actually
 * share things come first: a link to send, and a square to point a camera at.
 *
 * The link is built by the server, so the QR and the copy button can never
 * encode different things.
 */
export function InvitePanel({ onJoined }: { onJoined?: () => void }) {
  const toast = useToast();
  const [invite, setInvite] = useState<{ code: string; url: string; expiresAt: Date } | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const createInvite = trpc.space.createInvite.useMutation({
    onSuccess: (data) => {
      // The origin comes from here, not the server: an invite made on a
      // preview deployment or a laptop must point at THAT app, not at the
      // canonical production host.
      setInvite({
        code: data.code,
        url: `${window.location.origin}${data.path}`,
        expiresAt: data.expiresAt,
      });
      setCopied(null);
      onJoined?.();
    },
    onError: (err) =>
      toast(
        err.message === "SPACE_FULL"
          ? "Không gian đã đủ hai người rồi"
          : readableFormError(err.message, "Chưa tạo được lời mời"),
        "error",
      ),
  });

  async function copy(text: string, what: "link" | "code") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied((c) => (c === what ? null : c)), 2000);
      toast(what === "link" ? "Đã chép đường liên kết" : "Đã chép mã", "success");
    } catch {
      // Clipboard is blocked in some in-app browsers; the text is on screen
      // and selectable, so say that rather than failing silently.
      toast("Trình duyệt không cho chép tự động — bạn chọn rồi chép tay nhé", "error");
    }
  }

  async function share(url: string) {
    // The native sheet is the shortest path on a phone, and it is the only
    // way to reach Zalo and Messenger without hardcoding either.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Vivu No Plan",
          text: "Vào chung không gian với mình nhé",
          url,
        });
        return;
      } catch {
        /* Cancelled, or not permitted — fall through to copying. */
      }
    }
    await copy(url, "link");
  }

  const days = invite
    ? Math.max(0, Math.round((new Date(invite.expiresAt).getTime() - Date.now()) / 86_400_000))
    : 0;

  if (!invite) {
    return (
      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full"
          disabled={createInvite.isPending}
          onClick={() => createInvite.mutate()}
        >
          <QrCode className="mr-2 h-4 w-4" />
          {createInvite.isPending ? "Đang tạo…" : "Tạo lời mời"}
        </Button>
        <p className="text-muted-foreground text-xs">
          Một đường liên kết và một mã QR. Dùng được một lần, hết hạn sau 7 ngày.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <InviteQr url={invite.url} label="Mã QR mời vào không gian" />

      <div className="flex gap-2">
        <Button className="flex-1" onClick={() => void share(invite.url)}>
          <Share2 className="mr-2 h-4 w-4" /> Gửi lời mời
        </Button>
        <Button
          variant="outline"
          aria-label="Chép đường liên kết"
          onClick={() => void copy(invite.url, "link")}
        >
          {copied === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>

      {/* The link in full, because people check what they are about to send. */}
      <button
        type="button"
        onClick={() => void copy(invite.url, "link")}
        className="border-border bg-muted/50 hover:bg-muted flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors"
        style={{ minHeight: 44 }}
      >
        <Link2 className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-xs">{invite.url}</span>
      </button>

      {/*
        The code stays. Somebody sitting across a table reads it out in three
        seconds, and that is faster than sending a link to the person opposite.
      */}
      <div className="border-border rounded-xl border border-dashed p-3 text-center">
        <p className="text-muted-foreground text-[11px]">hoặc đọc mã này cho người kia</p>
        <button
          type="button"
          onClick={() => void copy(invite.code, "code")}
          className="font-mono text-xl tracking-[0.2em] transition-opacity hover:opacity-70"
          aria-label="Chép mã mời"
        >
          {invite.code}
        </button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">
          {days > 0 ? `Còn hiệu lực ${days} ngày · dùng một lần` : "Hết hạn hôm nay · dùng một lần"}
        </p>
        <button
          type="button"
          onClick={() => createInvite.mutate()}
          disabled={createInvite.isPending}
          className="text-muted-foreground hover:text-accent-ink inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors"
          style={{ minHeight: 36 }}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${createInvite.isPending ? "animate-spin" : ""}`} />
          Tạo mã mới
        </button>
      </div>
    </div>
  );
}
