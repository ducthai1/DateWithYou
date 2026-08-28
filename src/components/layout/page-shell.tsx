import { cn } from "@/lib/utils";

/**
 * The page container and its sticky title banner, in one place.
 *
 * Four screens had grown their own copy of the same two blocks — the
 * `max-w-[1400px]` column and the `sticky top-2 … rounded-2xl` gradient banner
 * — so a spacing change meant four edits and they had already drifted apart.
 *
 * More importantly they were all tuned against a ~900px-tall window. At 600px,
 * which is exactly what 150% browser zoom gives on a 13" MacBook, the top
 * padding, the banner and its bottom margin spent ~180px before a single row of
 * content appeared. The `short:` and `shorter:` variants pull that back, so the
 * same screen stays usable zoomed in instead of turning into a scroll tube.
 */

export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // The gutter is published as a variable so a full-bleed row can cancel
        // exactly this padding instead of assuming it. ScrollStrip used to
        // hard-code -mx-4; the moment `shorter` narrowed the gutter to 12px
        // that bled 4px past the screen and the page scrolled sideways.
        "[--page-gutter:1rem] shorter:[--page-gutter:0.75rem] md:[--page-gutter:30px]",
        "mx-auto w-full max-w-[1400px] space-y-6 px-[var(--page-gutter)] pt-6 pb-6",
        "short:space-y-4 short:pt-3 shorter:space-y-3",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode;
  /** One line of orientation. Hidden when the window is too short to spare it. */
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "from-gradient-from/15 to-gradient-to/15 sticky top-2 z-20 mb-6 flex flex-col gap-y-3 rounded-2xl bg-gradient-to-r px-4 py-4 shadow-sm backdrop-blur-md",
        "sm:flex-row sm:items-center sm:justify-between sm:gap-y-0",
        // Zoomed in, the banner keeps its job — saying where you are — on
        // roughly half the height.
        "short:mb-3 short:rounded-xl short:py-2.5 shorter:top-1 shorter:py-2",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-accent truncate text-2xl font-semibold short:text-xl shorter:text-lg">
          {title}
        </h1>
        {subtitle ? (
          // Dropped rather than shrunk: at this height every line is a
          // trade against content, and the title already says where you are.
          <p className="text-muted-foreground mt-0.5 text-sm short:hidden">{subtitle}</p>
        ) : null}
      </div>
      {/* Wraps on a narrow screen instead of crushing its contents. The
          library header holds a search field and two buttons; on one 390px row
          the field collapsed to ~90px and the button broke onto two lines. */}
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0 sm:flex-nowrap">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
