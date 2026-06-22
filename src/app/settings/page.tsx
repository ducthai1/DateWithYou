"use client";

import dynamic from "next/dynamic";

// Settings is a fully interactive, behind-auth screen that relies on
// better-auth's useSession (which throws during SSR — "Cannot read properties of
// null (reading 'useRef')"), so server-rendering it only produces an error that
// React then discards to re-render on the client. Client-only rendering skips
// that wasted, error-throwing SSR pass.
const SpaceSettings = dynamic(
  () => import("@/features/space/space-settings").then((m) => m.SpaceSettings),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Đang tải…
      </div>
    ),
  },
);

export default function SettingsPage() {
  return <SpaceSettings />;
}
