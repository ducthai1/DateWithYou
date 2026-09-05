import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { WaxSeal } from "./wax-seal";

// Romantic serif faces loaded in layout.tsx. Applied inline so the app-wide
// `font-serif` (Inter) is untouched — only this letter opts into real serifs.
const DISPLAY = "var(--font-capsule), ui-serif, Georgia, serif";
const LETTER = "var(--font-letter), ui-serif, Georgia, serif";

const WINE = "#7a1325";
const GOLD = "#c8a24c";

/** Premium vintage love-letter card shown once a capsule is opened. Cream paper
 *  with subtle grain, gold-foil rule, wax-seal emblem, Playfair title + Lora body. */
export function CapsuleLetter({
  title,
  message,
  openedDateLabel,
  sender,
}: {
  title: string;
  message: string | null;
  openedDateLabel: string;
  sender: string;
}) {
  return (
    <div
      className="relative mx-auto max-h-[82vh] w-full max-w-xl overflow-hidden rounded-[6px] shadow-[0_30px_80px_-20px_rgba(60,10,20,0.65)]"
      style={{
        // Layered warm-cream paper with a faint fibre grain + corner vignette.
        background:
          "radial-gradient(120% 80% at 50% 0%, #fffdf8 0%, #fbf6ec 55%, #f4ead7 100%)",
      }}
    >
      {/* Paper grain + vignette overlay (pure CSS, no network image). */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.5] mix-blend-multiply"
        style={{
          backgroundImage:
            "radial-gradient(rgba(120,90,40,0.06) 1px, transparent 1px), radial-gradient(rgba(120,90,40,0.05) 1px, transparent 1px)",
          backgroundSize: "7px 7px, 11px 11px",
          backgroundPosition: "0 0, 3px 4px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ boxShadow: "inset 0 0 120px rgba(110,60,20,0.14)" }}
      />

      {/* Thin gold inner frame for a printed-card feel. */}
      <div
        className="pointer-events-none absolute inset-3 rounded-[4px]"
        style={{ border: `1px solid ${GOLD}55` }}
      />

      <div className="relative max-h-[82vh] overflow-y-auto overflow-x-hidden px-5 py-8 sm:px-8 sm:py-10 md:px-14 md:py-14">
        {/* Wax seal emblem */}
        <div className="mb-6 flex justify-center">
          <WaxSeal size={56} />
        </div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="text-center text-[1.4rem] leading-tight sm:text-[1.9rem] md:text-[2.4rem]"
          style={{ fontFamily: DISPLAY, color: WINE, fontWeight: 600 }}
        >
          {title}
        </motion.h2>

        {/* Gold-foil divider with center ornament */}
        <div className="my-7 flex items-center justify-center gap-3" aria-hidden>
          <span className="h-px w-16 md:w-24" style={{ background: `linear-gradient(90deg, transparent, ${GOLD})` }} />
          <span className="text-lg" style={{ color: GOLD }}>✦</span>
          <span className="h-px w-16 md:w-24" style={{ background: `linear-gradient(90deg, ${GOLD}, transparent)` }} />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {message ? (
            <p
              className="whitespace-pre-wrap text-[0.95rem] leading-[1.85] sm:text-[1.08rem] sm:leading-[1.95] md:text-[1.18rem]"
              style={{ fontFamily: LETTER, color: "#43352c" }}
            >
              {message}
            </p>
          ) : (
            <p className="flex items-center justify-center italic text-stone-400" style={{ fontFamily: LETTER }}>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang mở nội dung tuyệt mật…
            </p>
          )}
        </motion.div>

        {/* Footer metadata */}
        <div className="mt-12 flex items-end justify-between border-t pt-5" style={{ borderColor: `${GOLD}40` }}>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: `${WINE}99` }}>
              Được mở vào
            </p>
            <p className="mt-0.5 text-stone-600" style={{ fontFamily: LETTER }}>
              {openedDateLabel}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: `${WINE}99` }}>
              Người gửi
            </p>
            <p className="mt-0.5 text-lg" style={{ fontFamily: DISPLAY, color: WINE, fontWeight: 600 }}>
              {sender}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
