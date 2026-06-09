"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";

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
    // No space yet → go onboard. Gate on a successful fetch returning null so a
    // transient getMine error doesn't bounce a user who actually has a space.
    if (mine.isSuccess && mine.data === null) router.replace("/onboarding");
  }, [mine.data, mine.isSuccess, router]);

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
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12 lg:max-w-lg">
      <h1 className="text-3xl font-semibold">Cài đặt không gian</h1>

      <Card className="space-y-3">
        <p className="text-sm font-medium">Tên & màu chủ đạo</p>
        <Input placeholder="Tên không gian" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex items-center gap-3">
          <label className="border-border flex items-center gap-2 rounded-xl border px-2 py-1.5 text-xs">
            <input
              type="color"
              value={themeColor}
              onChange={(e) => setThemeColor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded-md border-0 bg-transparent p-0"
              aria-label="Màu chủ đạo"
            />
            <span className="text-muted-foreground font-mono">{themeColor}</span>
          </label>
          <Button
            disabled={updateTheme.isPending}
            onClick={() => updateTheme.mutate({ name: name.trim(), themeColor })}
            className="flex-1"
          >
            {updateTheme.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
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
              <div className="border-border bg-muted rounded-xl border p-3 text-center">
                <p className="text-muted-foreground text-xs">
                  Mã mời (dùng 1 lần, hết hạn sau 7 ngày)
                </p>
                <p className="font-mono text-2xl tracking-widest">{invite}</p>
              </div>
            )}
          </>
        )}
      </Card>

      <ConfirmButton
        title="Đăng xuất"
        description="Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?"
        confirmText="Đăng xuất"
        idle="Đăng xuất"
        icon={<LogOut className="h-4 w-4" />}
        onConfirm={() => authClient.signOut().then(() => router.replace("/sign-in"))}
        className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-destructive bg-card text-sm font-medium text-destructive shadow-sm transition-all hover:bg-destructive hover:!text-white active:scale-[0.98] !no-underline"
      />
    </div>
  );
}
