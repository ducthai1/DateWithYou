"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavigationInviteModalProps {
  locationName: string;
  onAccept: () => void;
  onDecline: () => void;
  isPending?: boolean;
}

export function NavigationInviteModal({
  locationName,
  onAccept,
  onDecline,
  isPending = false,
}: NavigationInviteModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: "spring", damping: 20 }}
          className="bg-card rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-4"
        >
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-3xl">
                💌
              </div>
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-5 w-5 bg-rose-500" />
              </span>
            </div>
          </div>
          <div className="text-center space-y-1">
            <h3 className="font-semibold text-lg">Rủ rê nè! 💌</h3>
            <p className="text-muted-foreground text-sm">Người ấy muốn cùng bạn phóng tới…</p>
            <p className="font-bold text-accent text-lg">{locationName}</p>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Mở bản đồ lên, hai đứa thấy nhau trên đường luôn nha 🥰
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={isPending}
              onClick={onDecline}
            >
              Để lát nhaa
            </Button>
            <Button
              className="flex-1 gap-2"
              disabled={isPending}
              onClick={onAccept}
            >
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <span>🛵</span>
              )}
              Đi liền!
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
