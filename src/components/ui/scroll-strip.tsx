import { cn } from "@/lib/utils";

/**
 * A row that scrolls sideways on small screens, with an edge fade so it reads
 * as "there is more" rather than "this is cut off".
 *
 * The tab strips already scrolled, but nothing said so: the last tab simply
 * ended at the screen edge and looked broken. The fade is drawn over the page
 * background, so when the row does fit it is invisible and costs nothing.
 *
 * `-mx-4 px-4` lets the row bleed to the screen edges while its first and last
 * items keep the page's gutter, which is how horizontal rails are normally
 * built; from md up it stops being a rail at all.
 */
export function ScrollStrip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative -mx-4 md:mx-0", className)}>
      <div className="overflow-x-auto px-4 pb-0.5 md:overflow-visible md:px-0">
        {children}
      </div>
      <div
        aria-hidden="true"
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent md:hidden"
      />
    </div>
  );
}
