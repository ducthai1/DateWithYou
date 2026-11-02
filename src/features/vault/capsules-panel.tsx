import { useState, useEffect } from "react";
import { usePartnerName } from "@/features/space/use-partner";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Plus, Lock, Unlock, Loader2, Hourglass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LoadFailed } from "@/components/ui/load-failed";
import { EmptyState } from "@/components/ui/empty-state";
import { ToneArt } from "@/components/theme/tone-art";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { CapsuleUnlockModal } from "./capsule-unlock-modal";
import { CapsuleCreateForm } from "./capsule-create-form";

export function CapsulesPanel() {
  const partnerName = usePartnerName();
  const session = authClient.useSession();
  const user = session.data?.user;
  const utils = trpc.useUtils();
  const list = trpc.capsule.list.useQuery();
  const [formOpen, setFormOpen] = useState(false);

  const [selectedCapsule, setSelectedCapsule] = useState<{ id: string; title: string; message: string | null; unlockDate: string | Date; isOpened: boolean; creatorId?: string } | null>(null);

  // Realtime tick to re-render countdowns
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      {/*
        Bespoke instead of the shared PageHeader: this panel is one tab of
        VaultPage, which already renders its own <h1> above the tab strip.
        Reusing PageHeader here would put two <h1>s on one page, so this
        keeps the <h2> and borrows PageHeader's art-plus-scrim look by hand.
      */}
      <div className="relative min-h-[6rem] overflow-hidden rounded-2xl sm:min-h-[7rem]">
        <ToneArt name="mapTreasure" alt="" fill position="center 35%" sizes="(max-width: 768px) 100vw, 900px" className="-z-10" />
        <div
          aria-hidden="true"
          className="from-card/95 via-card/70 to-card/15 absolute inset-0 -z-10 bg-gradient-to-r"
        />
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold font-serif flex items-center gap-2">
            <Hourglass className="h-5 w-5 text-accent-ink shrink-0" /> Hộp Thời Gian
          </h2>
          <Button onClick={() => setFormOpen(true)} className="btn-sheen gap-2 rounded-full shadow-md bg-accent hover:bg-accent/90 text-white w-full sm:w-auto shrink-0">
            <Plus className="h-4 w-4" /> Giấu kỷ niệm
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Viết một bức thư bí mật, chọn ngày mở khoá. Đến hạn, người kia mới đọc được — như một bất ngờ gửi từ hiện tại tới tương lai.
      </p>

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <CapsuleCreateForm partnerName={partnerName} onDone={() => setFormOpen(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {list.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : list.isError ? (
        /* Trước `length === 0`: lỗi cũng cho danh sách rỗng, và nhánh rỗng bên
           dưới sẽ nói "Chưa có hộp nào" thay vì "chưa tải được". */
        <LoadFailed what="các hộp thời gian" onRetry={() => void list.refetch()} retrying={list.isFetching} />
      ) : list.data?.length === 0 ? (
        <EmptyState
          art="vaultSafe"
          icon="gift"
          title="Chưa có hộp nào"
          subtitle="Viết bức thư bí mật + chọn ngày mở khoá để tạo bất ngờ cho người kia."
          action={{ label: "Tạo ngay", onClick: () => setFormOpen(true) }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {list.data?.map((capsule) => {
            const isLocked = new Date(capsule.unlockDate) > now;
            const isCreator = capsule.creatorId === user?.id;

            return (
              <motion.div
                key={capsule.id}
                layoutId={`capsule-${capsule.id}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedCapsule(capsule)}
                className={`relative overflow-hidden rounded-2xl border cursor-pointer transition-colors p-5 touch-manipulation ${
                  isLocked
                    ? "bg-muted/30 border-muted-foreground/20 hover:border-accent/50"
                    : capsule.isOpened
                    ? "bg-card border-border"
                    : "bg-accent/10 border-accent shadow-lg shadow-accent/20"
                }`}
              >
                {/* Background decorative artwork — was a Lock/Unlock glyph at
                    5% opacity; the badge above already states locked/opened,
                    so this spot was pure decoration and can carry the
                    vault's own art instead. */}
                <div className="pointer-events-none absolute -right-4 -bottom-4 h-32 w-32 overflow-hidden rounded-2xl opacity-10">
                  <ToneArt name="vaultSafe" alt="" fill position="center" sizes="128px" />
                </div>

                <div className="relative z-10">
                  <div className="flex flex-col gap-1.5 mb-2 sm:flex-row sm:justify-between sm:items-start">
                    <h3 className="font-bold text-lg font-serif line-clamp-2 min-w-0">{capsule.title}</h3>
                    <div className="shrink-0">
                      {isLocked ? (
                        <div className="bg-muted px-2 py-1 rounded-full inline-flex items-center text-xs font-semibold text-muted-foreground">
                          <Lock className="h-3 w-3 mr-1" /> Bị Khóa
                        </div>
                      ) : capsule.isOpened ? (
                        <div className="bg-green-100 text-green-600 px-2 py-1 rounded-full inline-flex items-center text-xs font-semibold">
                          <Unlock className="h-3 w-3 mr-1" /> Đã Mở
                        </div>
                      ) : (
                        <div className="bg-accent px-2 py-1 rounded-full inline-flex items-center text-xs font-semibold text-white animate-pulse">
                          <Unlock className="h-3 w-3 mr-1" /> Có thể mở!
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Từ: <span className="font-medium text-foreground">{isCreator ? "Bạn" : partnerName}</span>
                  </p>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    {isLocked ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Mở khóa sau</p>
                        <p className="text-lg font-mono font-bold text-accent-ink">
                          {formatDistanceToNow(new Date(capsule.unlockDate), { locale: vi, addSuffix: false })}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Đã mở khóa vào</p>
                        <p className="text-sm font-medium">
                          {format(new Date(capsule.unlockDate), "dd/MM/yyyy HH:mm", { locale: vi })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {selectedCapsule && (
        <CapsuleUnlockModal
          capsule={selectedCapsule}
          now={now}
          onClose={() => setSelectedCapsule(null)}
          onOpened={() => utils.capsule.list.invalidate()}
        />
      )}
    </div>
  );
}
