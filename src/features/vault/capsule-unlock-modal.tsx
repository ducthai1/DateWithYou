import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import confetti from "canvas-confetti";
import { trpc } from "@/lib/trpc";
import { CapsuleEnvelope } from "./capsule-envelope";
import { CapsuleLetter } from "./capsule-letter";

type UnlockState = "locked" | "unlocking" | "opened";

export function CapsuleUnlockModal({
  capsule,
  now,
  onClose,
  onOpened,
}: {
  capsule: { id: string; title: string; message: string | null; unlockDate: string | Date; isOpened: boolean };
  now: Date;
  onClose: () => void;
  onOpened: () => void;
}) {
  const isTimeArrived = new Date(capsule.unlockDate) <= now;
  const [unlockState, setUnlockState] = useState<UnlockState>(capsule.isOpened ? "opened" : "locked");

  const markOpened = trpc.capsule.markOpened.useMutation();
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Close on Escape; clear any pending reveal/confetti timers on unmount so we
  // never setState (or fire confetti) after the user has closed the modal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      // Intentionally read the live ref at unmount to clear every timer pushed
      // during the component's life (capturing early would miss later ones).
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timers.current.forEach(clearTimeout);
    };
  }, [onClose]);

  const celebrate = () => {
    const colors = ["#c8a24c", "#8b1c31", "#fbf3e6"];
    confetti({ particleCount: 90, spread: 75, startVelocity: 45, origin: { y: 0.5 }, colors });
    timers.current.push(setTimeout(() => confetti({ particleCount: 50, spread: 100, decay: 0.92, scalar: 0.9, origin: { y: 0.5 }, colors }), 250));
  };

  const handleSealClick = () => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(isTimeArrived ? [60, 40, 80, 40, 160, 80, 300] : 50);
    }
    if (!isTimeArrived || unlockState !== "locked") return;

    setUnlockState("unlocking");
    if (!capsule.isOpened) {
      markOpened.mutate({ id: capsule.id }, { onSuccess: () => onOpened() });
    }
    // Let the seal crack + flap swing, then reveal the letter.
    timers.current.push(setTimeout(() => {
      setUnlockState("opened");
      celebrate();
    }, 1700));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden p-4"
        style={{
          // Contained radial — uses % units so it never overflows the viewport on mobile.
          background:
            "radial-gradient(ellipse 100% 100% at 50% 30%, rgba(60,12,22,0.86), rgba(10,6,8,0.95))",
          backdropFilter: "blur(10px)",
        }}
        onClick={unlockState === "opened" ? onClose : undefined}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-2 text-white/90 transition-colors hover:bg-white/20 touch-manipulation"
          style={{ minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
          aria-label="Đóng"
        >
          <X className="h-6 w-6" />
        </button>

        <AnimatePresence mode="wait">
          {unlockState !== "opened" ? (
            <motion.div
              key="envelope"
              exit={{ opacity: 0, scale: 1.4, filter: "blur(12px)" }}
              transition={{ duration: 0.6, ease: "easeInOut" }}
              onClick={(e) => e.stopPropagation()}
            >
              <CapsuleEnvelope
                state={unlockState}
                title={capsule.title}
                isTimeArrived={isTimeArrived}
                unlockDate={capsule.unlockDate}
                onSealClick={handleSealClick}
              />
            </motion.div>
          ) : (
            <motion.div
              key="letter"
              initial={{ y: 60, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: "spring", damping: 22, stiffness: 120, delay: 0.1 }}
              className="w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <CapsuleLetter
                title={capsule.title}
                message={capsule.message}
                openedDateLabel={`Ngày ${new Date().toLocaleDateString("vi-VN")}`}
                sender="Bí mật"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
