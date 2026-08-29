import { ToneArt } from "@/components/theme/tone-art";

/**
 * Shared frame for the four auth screens.
 *
 * The problem it solves is not "the page has no background colour". At any
 * desktop width the form is a ~380px column adrift in a very wide empty field,
 * and tinting that field just makes it a coloured empty field. So above lg the
 * layout splits: the brand artwork takes one half and the form sits in the
 * other, which gives the column a wall to stand against instead of an ocean.
 *
 * The panel used to run the same dark teal artwork as the old landing hero, so
 * arriving here read as a sequence: dark landing, dark doorway, warm app. Now
 * that the landing hero opens on the same warm parchment as the app, that
 * argument is gone, so the panel switches to warm cream too.
 *
 * `bannerOurPage`, not `appShowcase`: the landing page already spends
 * `appShowcase` on its own showcase band, and running the same picture again
 * one click later would read as reused stock art rather than a considered
 * choice. `bannerOurPage` also happens to show the product's own splash
 * screen — "Vivu No Plan" in-frame on the left phone — inside the flat-lay,
 * which is a second, incidental brand touch on a panel that carries no
 * wordmark of its own.
 *
 * A Server Component: nothing here is interactive.
 */
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh">
      {/* Brand panel. Hidden below lg, where there is no width to spare and the
          form should own the screen. */}
      <aside
        aria-hidden="true"
        className="relative hidden w-[46%] shrink-0 overflow-hidden lg:block xl:w-1/2"
        style={{ backgroundColor: "#f6ede1" }}
      >
        {/* `fill` + `object-cover`, not `contain`: the source is a wide 16:9
            flat-lay and this panel is tall and narrow, so covering it crops
            the sides rather than letterboxing top and bottom — right for a
            background photo, wrong for text, which is why the wordmark
            artwork was never a candidate for this treatment.

            `position` biases the crop toward the left third of the frame,
            where the phone actually showing "Vivu No Plan" sits, rather than
            the geometric centre between the two phones. Decorative: the form
            still carries the name in real text (see auth-form.tsx's <h1>,
            no longer sr-only above lg — this panel does not repeat it). */}
        <ToneArt name="bannerOurPage" fill position="38% 42%" />
        {/* The artwork runs edge to edge, so contained inside a tall panel its
            top and bottom edges would show as a hard cut. These dissolve them
            into the panel's own cream ground instead. */}
        <div
          className="absolute inset-x-0 top-0 h-1/3"
          style={{ background: "linear-gradient(to bottom, #f6ede1, transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: "linear-gradient(to top, #f6ede1, transparent)" }}
        />
        {/* Feathered inner edge, so the panel dissolves into the form side
            instead of ending on a hard vertical line. */}
        <div
          className="absolute inset-y-0 right-0 w-24"
          style={{
            background:
              "linear-gradient(to right, transparent, var(--background))",
          }}
        />
      </aside>

      {/* Form side. */}
      <main className="relative flex min-h-dvh flex-1 flex-col justify-center px-6 py-10">
        {/* Warm wash so the ground is never a flat white sheet, on any width.
            Built from theme tokens, so it follows whichever accent preset the
            couple picked rather than pinning one colour. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background: [
              "radial-gradient(70% 55% at 50% 0%, var(--accent-soft) 0%, transparent 65%)",
              "radial-gradient(60% 45% at 15% 100%, var(--accent-soft) 0%, transparent 60%)",
              "var(--background)",
            ].join(", "),
            opacity: 0.9,
          }}
        />
        <div className="relative z-10 mx-auto w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
