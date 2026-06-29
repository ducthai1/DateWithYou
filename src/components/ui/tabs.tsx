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
  const activeIndex = tabs.findIndex((t) => t.key === value);

  return (
    <div className={cn("bg-muted flex rounded-xl p-1 text-sm relative", className)}>
      <div className="absolute inset-y-1 left-1 right-1 pointer-events-none" aria-hidden="true">
        <motion.div
          className="h-full rounded-lg bg-background shadow-sm"
          initial={false}
          animate={{
            width: `${100 / tabs.length}%`,
            x: `${activeIndex * 100}%`,
          }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
        />
      </div>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "relative flex-1 rounded-lg py-2 transition-colors outline-none z-10",
            value === t.key
              ? "font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
