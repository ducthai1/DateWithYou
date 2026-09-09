import { Skeleton } from "@/components/ui/skeleton";

/**
 * The loading boundary every screen inside the app was missing.
 *
 * It is not really about the skeleton. In the App Router a `<Link>` to a
 * DYNAMIC route with no loading boundary cannot be prefetched, and the
 * navigation does not commit until the server's payload arrives — so the URL
 * does not change, `usePathname()` does not change, and the bottom-nav tab the
 * person just tapped does not light up. Every route here is dynamic, because
 * the root layout reads the theme and tone cookies.
 *
 * Measured on a production build at 150ms RTT / 1.5 Mbps / 4× CPU, tapping a
 * tab:
 *
 *   without a boundary   URL changes 207–298ms after the tap (/home: 723ms)
 *   with one            URL changes  20– 67ms
 *
 * The content still takes its round trip either way. What changes is that the
 * tap is acknowledged now instead of later, which on a phone was the whole
 * complaint: "I press it and a second later the tab lights up".
 *
 * ── Why this is a shared component and not one root `loading.tsx` ──────────
 *
 * A root boundary is one file instead of fifteen, and that was the first
 * attempt. But it also wraps the marketing landing page, and its HTML then
 * carried this skeleton ahead of the real content in the stream — a flash of
 * grey bones on the page that exists to make a first impression. Route groups
 * would fix that by moving eighteen directories; re-exporting this from the
 * app screens fixes it by adding a line to each.
 *
 * Every screen in this app is a column of cards inside the same frame, so one
 * shape serves them all. A route with a truer shape of its own writes its own
 * `loading.tsx` instead — see /map, which shows the map veil.
 */
export default function AppRouteLoading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6">
      {/* The app's real rhythm: a hero band, then list rows, fading out down
          the page so it reads as "more below" rather than as a wall. */}
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full opacity-60" />
      <Skeleton className="h-20 w-full opacity-30" />
    </div>
  );
}
