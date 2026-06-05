"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function SpaceSettings() {
  const router = useRouter();
  const mine = trpc.space.getMine.useQuery();
  const utils = trpc.useUtils();

  const [name, setName] = useState("");
  const [themeColor, setThemeColor] = useState("#b08968");
  const [invite, setInvite] = useState<string | null>(null);

  useEffect(() => {
    if (mine.data) {
      setName(mine.data.name);
      setThemeColor(mine.data.themeColor);
    }
    // No space yet → go onboard.
    if (mine.isFetched && !mine.data) router.replace("/onboarding");
  }, [mine.data, mine.isFetched, router]);

  const updateTheme = trpc.space.updateTheme.useMutation({
    onSuccess: () => utils.space.getMine.invalidate(),
  });
  const createInvite = trpc.space.createInvite.useMutation({
    onSuccess: (d) => setInvite(d.code),
  });

  if (mine.isLoading || !mine.data) {
    return <p className="p-8 text-center text-sm">Đang tải…</p>;
  }

  const full = mine.data.memberCount >= 2;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-8 px-6 py-12">
      <h1 className="text-3xl font-semibold">Cài đặt không gian</h1>

      <section className="space-y-3">
        <p className="text-sm font-medium">Tên & màu chủ đạo</p>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={themeColor}
            onChange={(e) => setThemeColor(e.target.value)}
            className="h-11 w-14 rounded-xl border"
            aria-label="Màu chủ đạo"
          />
          <Button
            disabled={updateTheme.isPending}
            onClick={() => updateTheme.mutate({ name: name.trim(), themeColor })}
          >
            {updateTheme.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium">Mời người yêu</p>
        {full ? (
          <p className="text-muted-foreground text-sm">
            Không gian đã đủ 2 người 💞
          </p>
        ) : (
          <>
            <Button
              variant="outline"
              disabled={createInvite.isPending}
              onClick={() => createInvite.mutate()}
            >
              {createInvite.isPending ? "Đang tạo…" : "Tạo mã mời"}
            </Button>
            {invite && (
              <div className="border-border bg-muted/40 rounded-xl border p-3 text-center">
                <p className="text-muted-foreground text-xs">
                  Mã mời (dùng 1 lần, hết hạn sau 7 ngày)
                </p>
                <p className="font-mono text-2xl tracking-widest">{invite}</p>
              </div>
            )}
          </>
        )}
      </section>

      <Button
        variant="ghost"
        className="text-muted-foreground"
        onClick={() =>
          authClient.signOut().then(() => router.replace("/sign-in"))
        }
      >
        Đăng xuất
      </Button>
    </div>
  );
}
