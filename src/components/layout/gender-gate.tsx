"use client";

import { usePathname } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Modal, ModalContent } from "@/components/ui/modal";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { isPublicChrome, isAdminRoute } from "./nav-items";

/**
 * Asks once for the one thing the app cannot work out on its own.
 *
 * Reminders that address one of the two people ("nàng có thể mệt" vs "em nhớ
 * giữ ấm") need to know who is reading. There is no honest way to derive that:
 * a display name is not evidence, and Google's sign-in scopes never carry it —
 * `profile` returns name, email, picture and locale and stops there. So it is
 * asked, once, and only ever about oneself.
 *
 * Deliberately NOT built on `useSession`: that hook crashes this app's dynamic
 * server render (an invalid-hook / null-dispatcher fault), and this component
 * mounts in the root layout on every app screen — the worst possible place for
 * it. The authed tRPC query answers the same question and fails closed: a
 * signed-out visitor gets UNAUTHORIZED and the gate renders nothing.
 *
 * Skipped on the marketing/auth surface and on admin, matching every other
 * piece of app chrome, which also keeps the query off pages guests can reach.
 */
export function GenderGate() {
  const pathname = usePathname();
  const skip = isPublicChrome(pathname) || isAdminRoute(pathname);

  const utils = trpc.useUtils();
  const me = trpc.profile.me.useQuery(undefined, { enabled: !skip, retry: false });
  const setGender = trpc.profile.setGender.useMutation({
    onSuccess: () => {
      // The gate closes off `me`; the members list carries the same field and
      // feeds the gendered copy, so both have to be refetched.
      utils.profile.me.invalidate();
      utils.space.members.invalidate();
    },
  });

  // Nothing to ask while loading, when signed out, or once it is answered.
  if (skip || me.isLoading || me.error || me.data?.gender) return null;

  const choose = (gender: "male" | "female") => setGender.mutate({ gender });
  const busy = setGender.isPending;

  return (
    // No-op onClose: this one question has to be answered, so Esc and the
    // backdrop do not dismiss it. It is a single tap and never asked again.
    <Modal open onClose={() => {}}>
      <ModalContent>
        {/* Own heading, not ModalHeader: that one always renders a dismiss
            button, which reads as broken on a question with no way to skip. */}
        <h2 className="text-foreground mb-2 text-lg font-semibold">Bạn là…</h2>
        <p className="text-muted-foreground mb-4 text-sm leading-relaxed">
          Cho mình biết một lần thôi, để app nhắc và nói chuyện đúng giọng với mỗi
          người. Chỉ hai bạn thấy, và đổi lại được trong Cài đặt bất cứ lúc nào.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: "male", label: "Nam", emoji: "👦" },
              { value: "female", label: "Nữ", emoji: "👧" },
            ] as const
          ).map((o) => (
            <button
              key={o.value}
              type="button"
              disabled={busy}
              onClick={() => choose(o.value)}
              className={cn(
                "border-border hover:border-accent hover:bg-accent-soft/40 flex flex-col items-center gap-2 rounded-2xl border p-5 transition-colors disabled:opacity-50",
                setGender.variables?.gender === o.value && busy && "border-accent bg-accent-soft/40",
              )}
            >
              <span className="text-3xl" aria-hidden>
                {o.emoji}
              </span>
              <span className="text-foreground text-sm font-medium">{o.label}</span>
            </button>
          ))}
        </div>
        {busy && (
          <p className="text-muted-foreground mt-3 flex items-center justify-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang lưu…
          </p>
        )}
        {setGender.error && (
          <p className="text-destructive mt-3 text-center text-xs">
            Chưa lưu được, thử lại nhé.
          </p>
        )}
      </ModalContent>
    </Modal>
  );
}
