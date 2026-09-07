"use client";

import { motion, AnimatePresence } from "framer-motion";
import { usePartnerName } from "@/features/space/use-partner";
import { Headphones, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * "Nghe cùng nhau?" — the same card as the navigation invite, on purpose.
 *
 * The couple already knows what this looks like from "Cùng khởi hành", and the
 * owner asked for this flow to feel like that one. Same size, same two
 * buttons, same place on screen; only the icon, the colour and the words
 * differ, so recognising it takes no learning.
 */
export function ListenInviteModal({
  trackTitle,
  onAccept,
  onDecline,
  isPending = false,
}: {
  trackTitle: string;
  onAccept: () => void;
  onDecline: () => void;
  isPending?: boolean;
}) {
  // A space holds two people, so whoever sent this is the other one.
  const partnerName = usePartnerName();
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-card w-full max-w-sm space-y-4 rounded-2xl p-6 shadow-xl"
        >
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="bg-accent-soft text-accent flex h-16 w-16 items-center justify-center rounded-full">
                <Headphones className="h-7 w-7" aria-hidden="true" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="bg-accent/60 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
                <span className="bg-accent relative inline-flex h-5 w-5 rounded-full" />
              </span>
            </div>
          </div>
          <div className="space-y-1 text-center">
            <h3 className="text-lg font-semibold">Nghe cùng nhau nha 🎧</h3>
            <p className="text-muted-foreground text-sm">{partnerName} đang mở…</p>
            {/* The track is the reason to say yes, so it gets the emphasis. */}
            <p className="text-accent text-lg font-bold break-words">{trackTitle}</p>
          </div>
          <p className="text-muted-foreground text-center text-xs">
            Bấm nghe cùng là hai người cùng một chỗ trong bài, ai tạm dừng thì cùng dừng.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" disabled={isPending} onClick={onDecline}>
              Để lát nhaa
            </Button>
            <Button className="flex-1 gap-2" disabled={isPending} onClick={onAccept}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Headphones className="h-4 w-4" aria-hidden="true" />
              )}
              Nghe cùng
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
