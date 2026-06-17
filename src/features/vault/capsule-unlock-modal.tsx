import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock, X, Loader2, HeartHandshake } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import confetti from "canvas-confetti";
import { trpc } from "@/lib/trpc";

type UnlockState = "locked" | "unlocking" | "opened";

export function CapsuleUnlockModal({
  capsule,
  now,
  onClose,
  onOpened,
}: {
  capsule: any;
  now: Date;
  onClose: () => void;
  onOpened: () => void;
}) {
  const isTimeArrived = new Date(capsule.unlockDate) <= now;
  const [unlockState, setUnlockState] = useState<UnlockState>(
    capsule.isOpened ? "opened" : isTimeArrived ? "locked" : "locked"
  );
  
  const markOpened = trpc.capsule.markOpened.useMutation();

  const handleUnlockClick = () => {
    if (!isTimeArrived) {
      // Just shake the lock, it's not time yet
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(50);
      }
      return;
    }

    if (unlockState === "locked") {
      setUnlockState("unlocking");
      
      // Mark as opened in DB in background
      if (!capsule.isOpened) {
        markOpened.mutate({ id: capsule.id }, {
          onSuccess: () => onOpened()
        });
      }

      // Vibrate pattern for unlocking
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100, 50, 200, 100, 500]);
      }

      // After 2.5s of intense animation, switch to opened
      setTimeout(() => {
        setUnlockState("opened");
        
        // Confetti explosion
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#ffd700", "#ff69b4", "#ffffff"],
        });
      }, 2500);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 z-50 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* ── STATE 1 & 2: THE CHEST / LOCK ── */}
        <AnimatePresence>
          {(unlockState === "locked" || unlockState === "unlocking") && (
            <motion.div
              layoutId={`capsule-${capsule.id}`}
              className="relative flex flex-col items-center justify-center"
              exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
            >
              {/* Glowing Background during unlocking */}
              {unlockState === "unlocking" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: [1, 1.5, 3] }}
                  transition={{ duration: 2.5, ease: "easeIn" }}
                  className="absolute inset-0 z-0 rounded-full bg-amber-400 mix-blend-screen blur-[100px]"
                />
              )}

              <motion.button
                onClick={handleUnlockClick}
                whileHover={isTimeArrived && unlockState === "locked" ? { scale: 1.1 } : {}}
                whileTap={unlockState === "locked" ? { scale: 0.95 } : {}}
                animate={
                  unlockState === "unlocking"
                    ? {
                        x: [0, -10, 10, -10, 10, -5, 5, 0],
                        y: [0, -5, 5, -5, 5, 0],
                        rotate: [0, -5, 5, -5, 5, 0],
                        scale: [1, 1.1, 1.2, 1.3],
                      }
                    : { y: [0, -10, 0] }
                }
                transition={
                  unlockState === "unlocking"
                    ? { duration: 2.5, ease: "easeInOut" }
                    : { duration: 4, repeat: Infinity, ease: "easeInOut" }
                }
                className="relative z-10 flex h-48 w-48 flex-col items-center justify-center rounded-3xl bg-gradient-to-b from-gray-800 to-gray-900 border-4 border-gray-700 shadow-2xl shadow-black/50"
              >
                {unlockState === "unlocking" ? (
                  <motion.div
                    animate={{ scale: [1, 1.5], opacity: [1, 0] }}
                    transition={{ delay: 2, duration: 0.5 }}
                  >
                    <Unlock className="h-20 w-20 text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]" />
                  </motion.div>
                ) : (
                  <Lock className="h-20 w-20 text-gray-400" />
                )}
              </motion.button>

              <motion.div
                className="mt-8 text-center relative z-10"
                animate={unlockState === "unlocking" ? { opacity: 0 } : { opacity: 1 }}
              >
                <h2 className="text-3xl font-serif font-bold text-white mb-2">{capsule.title}</h2>
                
                {!isTimeArrived ? (
                  <div className="bg-black/50 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/10">
                    <p className="text-gray-400 text-sm uppercase tracking-widest font-semibold mb-1">Mở khóa sau</p>
                    <p className="text-2xl font-mono text-amber-400 font-bold">
                      {formatDistanceToNow(new Date(capsule.unlockDate), { locale: vi, addSuffix: false })}
                    </p>
                  </div>
                ) : (
                  <div className="animate-pulse bg-amber-500/20 text-amber-300 rounded-full px-6 py-2 border border-amber-500/50 mt-4">
                    Nhấn vào ổ khóa để mở
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── STATE 3: OPENED (THE LETTER) ── */}
        <AnimatePresence>
          {unlockState === "opened" && (
            <motion.div
              initial={{ y: "100vh", opacity: 0, rotateX: -45 }}
              animate={{ y: 0, opacity: 1, rotateX: 0 }}
              transition={{ type: "spring", damping: 20, stiffness: 100, delay: 0.2 }}
              className="w-full max-w-2xl"
            >
              <div className="relative bg-[#fdfbf7] rounded-sm shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Paper Texture/Styling */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cream-paper.png')" }}></div>
                
                {/* Top decorative header */}
                <div className="h-12 bg-[#8b1c31] flex items-center justify-center border-b-4 border-amber-500/50">
                  <HeartHandshake className="h-6 w-6 text-amber-400" />
                </div>

                <div className="p-8 md:p-12">
                  <h2 className="text-3xl md:text-4xl font-serif text-[#8b1c31] mb-6 text-center">{capsule.title}</h2>
                  
                  <div className="prose prose-rose max-w-none">
                    <p className="text-lg leading-relaxed text-gray-800 whitespace-pre-wrap font-serif">
                      {capsule.message || (
                        <span className="flex items-center text-gray-400 italic">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Đang tải nội dung tuyệt mật...
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="mt-12 flex justify-between items-end border-t border-gray-200 pt-6">
                    <div>
                      <p className="text-sm text-gray-400 uppercase tracking-widest">Được mở vào</p>
                      <p className="font-medium text-gray-600">Ngày {new Date().toLocaleDateString("vi-VN")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400 uppercase tracking-widest">Người gửi</p>
                      <p className="font-bold text-lg font-serif text-[#8b1c31]">Bí mật</p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </AnimatePresence>
  );
}
