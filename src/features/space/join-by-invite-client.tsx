"use client";

import dynamic from "next/dynamic";

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
    loading: () => (
      <main className="flex min-h-[100dvh] items-center justify-center px-5 py-10">
        <div className="border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center">
          <p className="text-muted-foreground text-sm">Đang mở lời mời…</p>
        </div>
      </main>
    ),
  },
);

export function JoinByInviteClient({ code }: { code: string }) {
  return <JoinByInvite code={code} />;
}
