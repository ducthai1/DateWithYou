"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";

const ONBOARDING_TABS = [
  { key: "create", label: "Tạo mới" },
  { key: "join", label: "Tham gia" },
] as const;

export function Onboarding() {
  const router = useRouter();
  const mine = trpc.space.getMine.useQuery();
  const [tab, setTab] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const create = trpc.space.create.useMutation({
    onSuccess: () => router.replace("/settings"),
  });
  const join = trpc.space.joinByCode.useMutation({
    onSuccess: () => router.replace("/settings"),
  });

  // Already in a space → skip onboarding.
  useEffect(() => {
    if (mine.data) router.replace("/settings");
  }, [mine.data, router]);

  if (mine.isLoading) {
    return <p className="p-8 text-center text-sm">Đang tải…</p>;
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold">Không gian của tụi mình</h1>
        <p className="text-muted-foreground text-sm">
          Tạo không gian mới hoặc tham gia bằng mã mời từ người yêu.
        </p>
      </div>

      <Tabs tabs={ONBOARDING_TABS} value={tab} onChange={setTab} />

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)", position: "absolute", width: "100%", top: 0, left: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
          {tab === "create" ? (
            <div className="space-y-3">
              <Input
                placeholder="Tên không gian (vd: Chuyện của Cá)"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              {create.error && (
                <p className="text-sm text-destructive">
                  {create.error.message === "ALREADY_IN_SPACE"
                    ? "Bạn đã có không gian rồi."
                    : `Không tạo được: ${create.error.message}`}
                </p>
              )}
              <Button
                className="w-full"
                disabled={!name.trim() || create.isPending}
                onClick={() => create.mutate({ name: name.trim() })}
              >
                {create.isPending ? "Đang tạo…" : "Tạo không gian"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="Nhập mã mời"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              {join.error && (
                <p className="text-sm text-destructive">
                  {join.error.message === "INVALID_OR_EXPIRED_CODE"
                    ? "Mã sai hoặc đã hết hạn."
                    : join.error.message === "ALREADY_IN_SPACE"
                      ? "Bạn đã có không gian rồi."
                      : "Không tham gia được, thử lại nhé."}
                </p>
              )}
              <Button
                className="w-full"
                disabled={!code.trim() || join.isPending}
                onClick={() => join.mutate({ code: code.trim() })}
              >
                {join.isPending ? "Đang tham gia…" : "Tham gia"}
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
      </div>
    </div>
  );
}
