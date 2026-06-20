import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Lock, Unlock, Loader2, Hourglass } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDistanceToNow, format } from "date-fns";
import { vi } from "date-fns/locale";
import { CapsuleUnlockModal } from "./capsule-unlock-modal";

export function CapsulesPanel() {
  const session = authClient.useSession();
  const user = session.data?.user;
  const utils = trpc.useUtils();
  const list = trpc.capsule.list.useQuery();
  const create = trpc.capsule.create.useMutation({
    onSuccess: () => {
      utils.capsule.list.invalidate();
      setFormOpen(false);
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [unlockDate, setUnlockDate] = useState("");

  const [selectedCapsule, setSelectedCapsule] = useState<{ id: string; title: string; message: string | null; unlockDate: string | Date; isOpened: boolean; creatorId?: string } | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !message || !unlockDate) return;
    create.mutate({
      title,
      message,
      unlockDate: new Date(unlockDate),
    });
  };

  // Realtime tick to re-render countdowns
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold font-serif flex items-center gap-2">
          <Hourglass className="h-5 w-5 text-accent" /> Hộp Thời Gian
        </h2>
        <Button onClick={() => setFormOpen(true)} className="gap-2 rounded-full shadow-md bg-accent hover:bg-accent/90 text-white">
          <Plus className="h-4 w-4" /> Giấu kỷ niệm
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Viết một bức thư bí mật, chọn ngày mở khoá. Đến hạn, người ấy mới đọc được — như một bất ngờ gửi từ hiện tại tới tương lai.
      </p>

      <AnimatePresence>
        {formOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <form onSubmit={handleSubmit} className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4 mb-6">
              <h3 className="font-semibold">Tạo hộp thời gian mới 🎁</h3>
              <Input
                placeholder="Tiêu đề (Vd: Thư gửi chồng 1 năm sau)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
              <Textarea
                placeholder="Viết tâm thư ở đây. Sẽ không ai đọc được cho đến ngày mở khóa..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[120px]"
                required
              />
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Ngày mở khóa</label>
                <Input
                  type="datetime-local"
                  value={unlockDate}
                  onChange={(e) => setUnlockDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setFormOpen(false)}>Hủy</Button>
                <Button type="submit" disabled={create.isPending} className="bg-accent hover:bg-accent/90 text-white">
                  {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4 mr-2" />}
                  Khóa Lại
                </Button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {list.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : list.data?.length === 0 ? (
        <EmptyState
          icon="gift"
          title="Chưa có hộp nào"
          subtitle="Viết bức thư bí mật + chọn ngày mở khoá để tạo bất ngờ cho người ấy."
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
                {/* Background decorative icon */}
                <div className="absolute -right-4 -bottom-4 opacity-5">
                  {isLocked ? <Lock className="h-32 w-32" /> : <Unlock className="h-32 w-32" />}
                </div>

                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg font-serif line-clamp-1">{capsule.title}</h3>
                    {isLocked ? (
                      <div className="bg-muted px-2 py-1 rounded-full flex items-center text-xs font-semibold text-muted-foreground">
                        <Lock className="h-3 w-3 mr-1" /> Bị Khóa
                      </div>
                    ) : capsule.isOpened ? (
                      <div className="bg-green-100 dark:bg-green-900/30 text-green-600 px-2 py-1 rounded-full flex items-center text-xs font-semibold">
                        <Unlock className="h-3 w-3 mr-1" /> Đã Mở
                      </div>
                    ) : (
                      <div className="bg-accent px-2 py-1 rounded-full flex items-center text-xs font-semibold text-white animate-pulse">
                        <Unlock className="h-3 w-3 mr-1" /> Có thể mở!
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-muted-foreground">
                    Từ: <span className="font-medium text-foreground">{isCreator ? "Bạn" : "Người ấy"}</span>
                  </p>

                  <div className="mt-4 pt-4 border-t border-border/50">
                    {isLocked ? (
                      <div>
                        <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider font-semibold">Mở khóa sau</p>
                        <p className="text-lg font-mono font-bold text-accent">
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
