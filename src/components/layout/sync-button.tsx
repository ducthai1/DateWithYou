"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

export function SyncButton({ 
  mode, 
  isCollapsed 
}: { 
  mode: "mobile" | "desktop";
  isCollapsed?: boolean;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const toast = useToast();
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    
    try {
      // Refresh Next.js server components
      router.refresh();
      
      // Only await active queries (the ones currently mounted on the screen)
      // This ensures we only call APIs for the current route and don't hang.
      await queryClient.invalidateQueries({ refetchType: "active" });
      
      toast("Đã đồng bộ dữ liệu mới nhất", "success");
    } catch (e) {
      console.error(e);
      toast("Đồng bộ thất bại, vui lòng thử lại", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  if (mode === "mobile") {
    return (
      <button
        onClick={handleSync}
        disabled={isSyncing}
        aria-label="Đồng bộ"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted active:bg-muted touch-manipulation"
      >
        <RefreshCw className={cn("h-5 w-5", isSyncing && "animate-spin text-accent")} />
      </button>
    );
  }

  // Desktop mode
  return (
    <button
      onClick={handleSync}
      disabled={isSyncing}
      aria-label="Đồng bộ"
      className={cn(
        "group flex items-center rounded-xl px-3 py-2.5 text-sm transition-all duration-200 text-muted-foreground hover:bg-muted/80 hover:text-foreground outline-none",
        isCollapsed ? "justify-center px-0" : "gap-3"
      )}
      title={isCollapsed ? "Đồng bộ dữ liệu" : undefined}
    >
      <RefreshCw className={cn("shrink-0 transition-transform", isCollapsed ? "h-[22px] w-[22px]" : "h-5 w-5", isSyncing && "animate-spin text-accent")} />
      <span
        className={cn(
          "overflow-hidden whitespace-nowrap transition-all duration-300",
          isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100",
          isSyncing && "text-accent font-medium"
        )}
      >
        {isSyncing ? "Đang đồng bộ..." : "Đồng bộ"}
      </span>
    </button>
  );
}
