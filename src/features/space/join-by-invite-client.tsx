"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import { StandaloneScreen } from "@/components/layout/standalone-screen";

/*
 * The invite screen, loaded in the browser only.
 *
 * `JoinByInvite` calls `authClient.useSession()`, and this app cannot server-
 * render that hook: it throws "Cannot read properties of null (reading
 * 'useRef')" during the server pass. The repo has paid for this twice already
 * — `providers.tsx` loads SpaceGuard and GoogleOneTap this way for the same
 * reason, and `gender-gate.tsx` avoids the hook outright.
 *
 * It bit here in the worst possible place: EVERY request to /moi/<code>
 * answered HTTP 500. In development that is invisible, because Next rebuilds
 * the page on the client after the server throws and the screen looks
 * correct — so an end-to-end check that reads the text passes while a link
 * sent through Zalo opens an error page. The e2e now asserts the status code
 * as well, which is the only thing that would have caught it.
 *
 * The page around this stays a Server Component so it keeps its `metadata` —
 * and with it `robots: noindex`, which matters because every invite URL
 * carries a live code.
 */
const JoinByInvite = dynamic(
  () => import("./join-by-invite").then((m) => m.JoinByInvite),
  {
    ssr: false,
    /*
     * The same shell as the screen it is standing in for.
     *
     * This was a hand-rolled copy of the old layout — max-w-sm, a #E5E7EB
     * hairline, no shadow at all — which made it the WORST-looking card on the
     * page rather than the least noticeable: a white rectangle with no edge,
     * on the artwork, and it is what every person who opens an invite link
     * sees first while this chunk downloads. An e2e that measures the panel's
     * treatment caught it; reading the text never would have.
     */
    loading: () => (
      <StandaloneScreen>
        <Loader2 className="text-accent h-8 w-8 animate-spin" aria-hidden />
        <p className="text-muted-foreground text-sm">Đang mở lời mời…</p>
      </StandaloneScreen>
    ),
  },
);

export function JoinByInviteClient({ code }: { code: string }) {
  return <JoinByInvite code={code} />;
}
