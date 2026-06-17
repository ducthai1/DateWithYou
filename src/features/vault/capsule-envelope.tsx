import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { WaxSeal } from "./wax-seal";

const DISPLAY = "var(--font-display), ui-serif, Georgia, serif";
const GOLD = "#c8a24c";

const W = 300;
const H = 188;
const FLAP = 96;

/** A sealed wax envelope. While locked it floats and shows the countdown (or a
 *  "tap the seal" hint once unlockable). On `unlocking` the wax seal cracks and
 *  flies apart, the flap swings open, and the whole thing glows — the parent then
 *  reveals the letter. */
export function CapsuleEnvelope({
  state,
  title,
  isTimeArrived,
  unlockDate,
  onSealClick,
}: {
  state: "locked" | "unlocking";
  title: string;
  isTimeArrived: boolean;
  unlockDate: string | Date;
  onSealClick: () => void;
}) {
  const opening = state === "unlocking";

  return (
    <motion.div
      className="relative flex flex-col items-center"
      animate={opening ? { y: 0 } : { y: [0, -10, 0] }}
      transition={opening ? { duration: 0 } : { duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      {/* Warm glow that blooms as it opens / pulses when ready */}
      <motion.div
        className="absolute left-1/2 top-1/2 -z-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgba(216,162,76,0.55), transparent 70%)", filter: "blur(40px)" }}
        animate={
          opening
            ? { opacity: [0.3, 0.9, 0], scale: [1, 1.8, 3] }
            : isTimeArrived
            ? { opacity: [0.25, 0.5, 0.25], scale: [1, 1.1, 1] }
            : { opacity: 0.12, scale: 1 }
        }
        transition={opening ? { duration: 2.2, ease: "easeIn" } : { duration: 3, repeat: Infinity }}
      />

      {/* Envelope */}
      <div className="relative" style={{ width: W, height: H, perspective: 900 }}>
        {/* Body */}
        <div
          className="absolute inset-0 rounded-xl"
          style={{
            background: "linear-gradient(160deg, #8b1c31 0%, #6c1325 100%)",
            boxShadow: `inset 0 0 0 1px ${GOLD}55, 0 24px 50px -12px rgba(60,8,18,0.7)`,
          }}
        />
        {/* Front pocket (upward triangle) for an envelope silhouette */}
        <div
          className="absolute bottom-0 left-0"
          style={{
            width: 0, height: 0,
            borderLeft: `${W / 2}px solid transparent`,
            borderRight: `${W / 2}px solid transparent`,
            borderBottom: `${H * 0.7}px solid rgba(0,0,0,0.12)`,
          }}
        />
        {/* Flap (downward triangle), hinged at the top edge */}
        <motion.div
          className="absolute left-0 top-0 origin-top"
          style={{
            width: 0, height: 0,
            borderLeft: `${W / 2}px solid transparent`,
            borderRight: `${W / 2}px solid transparent`,
            borderTop: `${FLAP}px solid #93203a`,
            filter: "drop-shadow(0 2px 2px rgba(0,0,0,0.25))",
            transformStyle: "preserve-3d",
          }}
          initial={false}
          animate={{ rotateX: opening ? -165 : 0 }}
          transition={{ duration: 0.7, delay: opening ? 0.55 : 0, ease: "easeInOut" }}
        />

        {/* Wax seal — sits over the flap tip; cracks apart on open */}
        <button
          type="button"
          onClick={onSealClick}
          aria-label={isTimeArrived ? "Mở kén thư" : "Chưa tới ngày mở"}
          className="absolute left-1/2 -translate-x-1/2 outline-none"
          style={{ top: FLAP - 32, zIndex: 5 }}
        >
          <motion.div
            whileHover={isTimeArrived && !opening ? { scale: 1.08 } : {}}
            whileTap={!opening ? { scale: 0.94 } : {}}
            animate={opening ? { scale: [1, 1.18, 0], rotate: [0, 10, -6, 0], opacity: [1, 1, 0] } : { scale: 1, opacity: 1 }}
            transition={opening ? { duration: 0.6, ease: "easeIn" } : { type: "spring", stiffness: 300 }}
          >
            <WaxSeal size={64} />
          </motion.div>
        </button>

        {/* Gold particle burst at the moment the seal breaks */}
        {opening &&
          Array.from({ length: 10 }).map((_, i) => {
            const angle = (i / 10) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute left-1/2 rounded-full"
                style={{ top: FLAP - 6, width: 6, height: 6, background: GOLD }}
                initial={{ x: 0, y: 0, opacity: 0 }}
                animate={{ x: Math.cos(angle) * 90, y: Math.sin(angle) * 90, opacity: [0, 1, 0], scale: [1, 0.4] }}
                transition={{ duration: 0.9, delay: 0.45, ease: "easeOut" }}
              />
            );
          })}
      </div>

      {/* Title + status */}
      <motion.div className="mt-9 text-center" animate={{ opacity: opening ? 0 : 1 }} transition={{ duration: 0.4 }}>
        <h2 className="mb-3 text-2xl md:text-3xl" style={{ fontFamily: DISPLAY, color: "#fbf3e6", fontWeight: 600 }}>
          {title}
        </h2>
        {isTimeArrived ? (
          <span
            className="inline-block rounded-full px-5 py-2 text-sm font-medium"
            style={{ color: "#fde8c4", background: "rgba(216,162,76,0.16)", border: `1px solid ${GOLD}80` }}
          >
            ✦ Chạm vào dấu sáp để mở
          </span>
        ) : (
          <div className="rounded-2xl px-6 py-3" style={{ background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: `${GOLD}cc` }}>
              Mở khóa sau
            </p>
            <p className="text-xl font-semibold" style={{ color: "#fde8c4" }}>
              {formatDistanceToNow(new Date(unlockDate), { locale: vi, addSuffix: false })}
            </p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
