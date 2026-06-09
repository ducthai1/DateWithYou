"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

/** Controlled pill tabs — shared by the vault and onboarding screens. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("bg-muted flex rounded-xl p-1 text-sm relative", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative flex-1 rounded-lg py-2 transition-colors outline-none",
            value === t.key
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === t.key && (
            <motion.div
              layoutId="tab-indicator"
              className="absolute inset-0 rounded-lg bg-background shadow-sm"
              transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
            />
          )}
          <span className="relative z-10">{t.label}</span>
        </button>
      ))}
    </div>
  );
}
