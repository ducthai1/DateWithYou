"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { authClient } from "@/lib/auth-client";
import { LogOut, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ConfirmButton } from "@/components/ui/confirm-button";
import {
  THEME_PRESETS,
  THEME_PRESET_KEYS,
  THEME_COOKIE_NAME,
  resolveThemeKey,
  type ThemePresetKey,
} from "@/lib/theme-presets";
import { cn } from "@/lib/utils";

export function SpaceSettings() {
  const router = useRouter();
  const mine = trpc.space.getMine.useQuery();
  const utils = trpc.useUtils();

  const allMine = trpc.space.getAllMine.useQuery();
  
  const [name, setName] = useState("");
  // Active preset key — initialised from DB, updated optimistically on swatch click
  const [activePreset, setActivePreset] = useState<ThemePresetKey>("terracotta");
  const [invite, setInvite] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");

  function handleSpaceSwitch(spaceId: string) {
    const maxAge = 60 * 60 * 24 * 365;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `active_space_id=${spaceId}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
    // Force a full page reload so that all queries re-fetch under the new space context
    window.location.reload();
  }

  useEffect(() => {
    if (mine.data) {
      setName(mine.data.name);
      setActivePreset(resolveThemeKey(mine.data.themePreset));
    }
    if (mine.isSuccess && mine.data === null) router.replace("/onboarding");
  }, [mine.data, mine.isSuccess, router]);

  const updateTheme = trpc.space.updateTheme.useMutation({
    onSuccess: () => utils.space.getMine.invalidate(),
  });
  const createInvite = trpc.space.createInvite.useMutation({
    onSuccess: (d) => setInvite(d.code),
  });
  const createSpace = trpc.space.create.useMutation({
    onSuccess: (data) => handleSpaceSwitch(data.id),
  });
  const joinSpace = trpc.space.joinByCode.useMutation({
    onSuccess: (data) => handleSpaceSwitch(data.id),
  });

  if (mine.isLoading || !mine.data || allMine.isLoading) {
    return <p className="p-8 text-center text-sm">Đang tải…</p>;
  }

  const full = mine.data.memberCount >= 2;

  /** Optimistically apply the preset locally, write the SSR cookie, then persist to DB. */
  function handlePresetSelect(key: ThemePresetKey) {
    setActivePreset(key);

    // Optimistic: set data-theme so CSS vars switch immediately without reload
    document.documentElement.dataset.theme = key;

    // Write the vivu_theme cookie so SSR layout picks it up on next navigation.
    // ~1 year maxAge; path=/ so all routes see it. Secure on HTTPS (prod).
    const maxAge = 60 * 60 * 24 * 365;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${THEME_COOKIE_NAME}=${key}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;

    updateTheme.mutate({ themePreset: key });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-12 lg:max-w-lg">
      <h1 className="text-3xl font-semibold">Cài đặt không gian</h1>

      {/* ── QUẢN LÝ KHÔNG GIAN ── */}
      <Card className="space-y-4 border-accent shadow-sm">
        <div>
          <p className="text-sm font-semibold mb-2 text-accent">Chuyển đổi không gian</p>
          <div className="flex flex-col gap-2">
            {allMine.data?.map(s => (
              <button
                key={s.id}
                onClick={() => handleSpaceSwitch(s.id)}
                className={cn(
                  "flex items-center justify-between rounded-lg border p-3 text-left transition-colors hover:bg-muted",
                  s.id === mine.data?.id ? "border-accent bg-accent/5 ring-1 ring-accent" : "border-border"
                )}
              >
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.memberCount} thành viên</p>
                </div>
                {s.id === mine.data?.id && <CheckCircle2 className="h-5 w-5 text-accent" />}
              </button>
            ))}
          </div>
        </div>
        
        <div className="pt-3 border-t border-border">
          <p className="text-sm font-medium mb-2">Tạo không gian mới</p>
          <Button
            variant="outline"
            className="w-full"
            disabled={createSpace.isPending}
            onClick={() => createSpace.mutate({ name: "Không gian mới" })}
          >
            {createSpace.isPending ? "Đang tạo..." : "Tạo không gian trống mới"}
          </Button>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-sm font-medium">Tham gia bằng mã mời</p>
          <div className="flex gap-2">
            <Input
              placeholder="Nhập mã mời"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <Button
              disabled={!joinCode.trim() || joinSpace.isPending}
              onClick={() => joinSpace.mutate({ code: joinCode.trim() })}
            >
              Tham gia
            </Button>
          </div>
          {joinSpace.isError && <p className="text-xs text-destructive">{joinSpace.error.message}</p>}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">Tên không gian</p>
        <Input
          placeholder="Tên không gian"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button
          disabled={updateTheme.isPending}
          onClick={() => updateTheme.mutate({ name: name.trim() })}
          className="w-full"
        >
          {updateTheme.isPending ? "Đang lưu…" : "Lưu tên"}
        </Button>
      </Card>

      <Card className="space-y-3">
        <p className="text-sm font-medium">Màu chủ đạo</p>
        {/* 6-swatch preset grid — one swatch per ThemePresetKey */}
        <div className="grid grid-cols-6 gap-2">
          {THEME_PRESET_KEYS.map((key) => {
            const preset = THEME_PRESETS[key];
            const isActive = activePreset === key;
            return (
              <button
                key={key}
                type="button"
                title={preset.label}
                aria-label={preset.label}
                aria-pressed={isActive}
                onClick={() => handlePresetSelect(key)}
                className={cn(
                  "h-9 w-9 rounded-full transition-all active:scale-90",
                  // Ring indicates selected preset
                  isActive
                    ? "ring-2 ring-offset-2 scale-110"
                    : "hover:scale-105 opacity-80 hover:opacity-100",
                )}
                style={{
                  background: `linear-gradient(135deg, ${preset.gradientFrom}, ${preset.gradientTo})`,
                  // Use the preset's own colour for the selection outline ring
                  outline: isActive ? `2px solid ${preset.ring}` : "none",
                  outlineOffset: "2px",
                }}
              />
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          {THEME_PRESETS[activePreset].label}
        </p>
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
