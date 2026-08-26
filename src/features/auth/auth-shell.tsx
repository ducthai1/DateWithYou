/**
 * Shared frame for the four auth screens.
 *
 * The problem it solves is not "the page has no background colour". At any
 * desktop width the form is a ~380px column adrift in a very wide empty field,
 * and tinting that field just makes it a coloured empty field. So above lg the
 * layout splits: the brand artwork takes one half and the form sits in the
 * other, which gives the column a wall to stand against instead of an ocean.
 *
 * It also sequences the product. The landing page is dark teal, the app inside
 * is warm parchment, and these screens are the doorway between them — teal
 * panel on one side, warm ground under the form on the other.
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
        style={{ backgroundColor: "#021617" }}
      >
        {/* The same artwork as the landing hero, so arriving here reads as the
            same place rather than a different product. Decorative: the form
            still carries the name in real text for assistive tech.

            `contain`, not `cover`: the artwork is wide and this panel is tall,
            so covering it cropped straight through the lettering. Contained, it
            sits whole on the teal ground — and that ground is sampled from the
            artwork's own corners, so the letterboxing is invisible. */}
        <div
          className="absolute inset-0 bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/hero-logo-tight.webp')",
            // Slightly wider than the panel so the artwork's own feathered side
            // edges fall just outside it, and it reads as filling the width.
            backgroundSize: "112% auto",
          }}
        />
        {/* The artwork is far brighter than the ground it sits on, so contained
            inside a tall panel its top and bottom edges showed as a band. These
            dissolve them into the panel colour. */}
        <div
          className="absolute inset-x-0 top-0 h-1/3"
          style={{ background: "linear-gradient(to bottom, #021617, transparent)" }}
        />
        <div
          className="absolute inset-x-0 bottom-0 h-1/3"
          style={{ background: "linear-gradient(to top, #021617, transparent)" }}
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
