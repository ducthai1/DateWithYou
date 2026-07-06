"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RoadmapBoard } from "@/features/vault/roadmap-board";
import { WishlistGrid } from "@/features/vault/wishlist-grid";
import { RewardsPanel } from "@/features/vault/rewards-panel";
import { CapsulesPanel } from "@/features/vault/capsules-panel";
import { Tabs } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Target, Gift, Coins, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "roadmap", label: "Kế hoạch", icon: Target },
  { key: "wishlist", label: "Wishlist", icon: Gift },
  { key: "rewards", label: "Phiếu bé ngoan", icon: Coins },
  { key: "capsules", label: "Hộp thời gian", icon: Hourglass },
] as const;

export default function VaultPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("roadmap");

  // Fetch summary stats
  const plans = trpc.plan.list.useQuery();
  const wishlist = trpc.wishlist.list.useQuery();
  const rewards = trpc.reward.overview.useQuery();

  const totalPlans = plans.data?.length ?? 0;
  const donePlans = plans.data?.filter(p => p.status === "done").length ?? 0;
  
  const totalWishlist = wishlist.data?.length ?? 0;
  const boughtWishlist = wishlist.data?.filter(w => w.bought).length ?? 0;

  const totalPoints = rewards.data?.balances.reduce((acc, b) => acc + b.balance, 0) ?? 0;

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 pt-6 pb-6 md:px-[30px]">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-r from-accent-soft/80 to-accent-soft/30 p-4 -mx-1">
          <h1 className="text-h1 font-serif text-accent">Góc bí mật</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Nơi lưu dự định, mong ước và phần thưởng riêng của hai bạn.</p>
        </div>

        {/* Summary Stats — 2 cols on mobile, 4 on md+ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            onClick={() => setTab("roadmap")}
            className={cn("bg-muted/40 hover:bg-muted/60 flex cursor-pointer flex-col justify-center rounded-2xl p-4 transition-colors", tab === "roadmap" && "bg-accent-soft/50 hover:bg-accent-soft/70 border border-accent/20")}
          >
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Target className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Kế hoạch</span>
            </div>
            <p className="text-xl font-bold tracking-tight">
              {donePlans} <span className="text-muted-foreground text-sm font-medium">/ {totalPlans}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-[10px] leading-tight">đã xong / tổng</p>
          </div>
          <div
            onClick={() => setTab("wishlist")}
            className={cn("bg-muted/40 hover:bg-muted/60 flex cursor-pointer flex-col justify-center rounded-2xl p-4 transition-colors", tab === "wishlist" && "bg-accent-soft/50 hover:bg-accent-soft/70 border border-accent/20")}
          >
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Gift className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Wishlist</span>
            </div>
            <p className="text-xl font-bold tracking-tight">
              {boughtWishlist} <span className="text-muted-foreground text-sm font-medium">/ {totalWishlist}</span>
            </p>
            <p className="text-muted-foreground mt-1 text-[10px] leading-tight">đã mua / tổng</p>
          </div>
          <div
            onClick={() => setTab("rewards")}
            className={cn("bg-muted/40 hover:bg-muted/60 flex cursor-pointer flex-col justify-center rounded-2xl p-4 transition-colors", tab === "rewards" && "bg-accent-soft/50 hover:bg-accent-soft/70 border border-accent/20")}
          >
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Coins className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Tổng điểm</span>
            </div>
            <p className="text-accent text-xl font-bold tracking-tight">
              {totalPoints}đ
            </p>
            <p className="text-muted-foreground mt-1 text-[10px] leading-tight">từ Phiếu bé ngoan</p>
          </div>
          <div
            onClick={() => setTab("capsules")}
            className={cn("bg-muted/40 hover:bg-muted/60 flex cursor-pointer flex-col justify-center rounded-2xl p-4 transition-colors", tab === "capsules" && "bg-accent-soft/50 hover:bg-accent-soft/70 border border-accent/20")}
          >
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-medium">
              <Hourglass className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Hộp thời gian</span>
            </div>
            <p className="text-xl font-bold tracking-tight">
              Bí mật
            </p>
          </div>
        </div>
      </div>

      {/* Tab strip: scrollable on mobile so all 4 tabs stay tappable at 360px */}
      <div className="overflow-x-auto pb-0.5 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
        <Tabs tabs={TABS} value={tab} onChange={setTab} className="min-w-[400px] md:min-w-0" />
      </div>
      
      <div className="relative pt-2">
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
            {tab === "capsules" && <CapsulesPanel />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
