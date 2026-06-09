"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoadmapBoard } from "@/features/vault/roadmap-board";
import { WishlistGrid } from "@/features/vault/wishlist-grid";
import { RewardsPanel } from "@/features/vault/rewards-panel";
import { Tabs } from "@/components/ui/tabs";

const TABS = [
  { key: "roadmap", label: "Kế hoạch" },
  { key: "wishlist", label: "Wishlist" },
  { key: "rewards", label: "Phiếu bé ngoan" },
] as const;

export default function VaultPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("roadmap");

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 lg:max-w-4xl">
      <h1 className="text-2xl font-semibold">Góc bí mật</h1>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)", position: "absolute", width: "100%", top: 0, left: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
          {tab === "roadmap" && <RoadmapBoard />}
          {tab === "wishlist" && <WishlistGrid />}
          {tab === "rewards" && <RewardsPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
