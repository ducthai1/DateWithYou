"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

      <div className="bg-muted flex rounded-xl p-1 text-sm">
        <button
          className={`flex-1 rounded-lg py-2 ${tab === "create" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setTab("create")}
        >
          Tạo mới
        </button>
        <button
          className={`flex-1 rounded-lg py-2 ${tab === "join" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          onClick={() => setTab("join")}
        >
          Tham gia
        </button>
      </div>

      {tab === "create" ? (
        <div className="space-y-3">
          <Input
            placeholder="Tên không gian (vd: Chuyện của Cá)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {create.error && (
            <p className="text-sm text-red-600">
              {create.error.message === "ALREADY_IN_SPACE"
                ? "Bạn đã có không gian rồi."
                : "Không tạo được, thử lại nhé."}
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
            <p className="text-sm text-red-600">
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
    </div>
  );
}
