import { cn } from "@/lib/utils";

/**
 * A row that scrolls sideways on small screens, with an edge fade so it reads
 * as "there is more" rather than "this is cut off".
 *
 * The tab strips already scrolled, but nothing said so: the last tab simply
 * ended at the screen edge and looked broken. The fade is drawn over the page
 * background, so when the row does fit it is invisible and costs nothing.
 *
 * The bleed cancels `--page-gutter`, the padding PageShell actually applied,
 * rather than a hard-coded 4. Assuming the gutter is what broke it before: at
 * 200% zoom the shell narrowed to 12px, the strip still pulled 16px, and the
 * page gained a 4px horizontal scrollbar. From md up it stops being a rail.
 */
export function ScrollStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("relative -mx-[var(--page-gutter,1rem)] md:mx-0", className)}
    >
      <div className="overflow-x-auto px-[var(--page-gutter,1rem)] py-1 md:overflow-visible md:px-0">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden"
      />
    </div>
  );
}
