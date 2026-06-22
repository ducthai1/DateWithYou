"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
type ToastItem = { id: number; message: string; variant: ToastVariant };

// Default no-op so calling useToast() outside the provider is harmless (SSR /
// tests) instead of throwing.
const ToastContext = createContext<(message: string, variant?: ToastVariant) => void>(() => {});

/** Fire a transient toast: `const toast = useToast(); toast("Đã lưu ✓")`. */
export function useToast() {
  return useContext(ToastContext);
}

const ICON = { success: Check, error: AlertCircle, info: Info } as const;

/**
 * App-wide transient feedback. After an action succeeds/fails a short pill
 * appears top-center and auto-dismisses — so users get a clear "it worked"
 * (or "it failed") signal instead of wondering whether anything happened.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  // Gate the body portal until after the first client render. `typeof document`
  // is already true during hydration, so portaling on the first render adds a
  // <body> child the server never emitted → React reports a hydration mismatch
  // and *regenerates the whole tree on the client* (flash + a window of dead
  // clicks app-wide). Rendering nothing until mounted keeps SSR and the first
  // client render identical; the portal appears on the next paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const push = useCallback((message: string, variant: ToastVariant = "success") => {
    const id = (idRef.current += 1);
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      {mounted &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] z-[100] flex flex-col items-center gap-2 px-4 md:top-6">
            <AnimatePresence>
              {toasts.map((t) => {
                const Icon = ICON[t.variant];
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: -16, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -12, scale: 0.95 }}
                    transition={{ type: "spring", duration: 0.35, bounce: 0.2 }}
                    className={cn(
                      "shadow-elev-2 flex max-w-[90vw] items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium",
                      t.variant === "success" && "bg-[var(--success)] text-white",
                      t.variant === "error" && "bg-destructive text-white",
                      t.variant === "info" && "bg-card text-foreground border-border border",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{t.message}</span>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}
