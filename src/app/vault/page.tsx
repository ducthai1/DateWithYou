"use client";

import { useState } from "react";
import { RoadmapBoard } from "@/features/vault/roadmap-board";
import { WishlistGrid } from "@/features/vault/wishlist-grid";
import { RewardsPanel } from "@/features/vault/rewards-panel";

const TABS = [
  { key: "roadmap", label: "Kế hoạch" },
  { key: "wishlist", label: "Wishlist" },
  { key: "rewards", label: "Phiếu bé ngoan" },
] as const;

export default function VaultPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("roadmap");

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <h1 className="text-2xl font-semibold">Góc bí mật</h1>
      <div className="bg-muted flex rounded-xl p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2 ${tab === t.key ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "roadmap" && <RoadmapBoard />}
      {tab === "wishlist" && <WishlistGrid />}
      {tab === "rewards" && <RewardsPanel />}
    </div>
  );
}
