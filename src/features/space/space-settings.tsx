"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
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

import { useToast } from "@/components/ui/toast";

const PRESET_AVATARS = [
  // Animals
  "/avatars/animal-1.svg", // Cat
  "/avatars/animal-2.svg", // Dog
  "/avatars/animal-3.svg", // Fox
  "/avatars/animal-4.svg", // Owl
  "/avatars/animal-5.svg", // Panda

  // Characters
  "/avatars/character-1.svg", // Ninja
  "/avatars/character-2.svg", // Astronaut
  "/avatars/character-3.svg", // Pirate
  "/avatars/character-4.svg", // Wizard
  "/avatars/character-5.svg", // Knight

  // Abstract
  "/avatars/abstract-1.svg",
  
  // Default
  "/avatars/default-1.svg"
];

export function SpaceSettings() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mine = trpc.space.getMine.useQuery();
  const utils = trpc.useUtils();
  const toast = useToast();

  const allMine = trpc.space.getAllMine.useQuery();
  
  const [name, setName] = useState("");
  // Active preset key — initialised from DB, updated optimistically on swatch click
  const [activePreset, setActivePreset] = useState<ThemePresetKey>("terracotta");
  const [invite, setInvite] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [newSpaceName, setNewSpaceName] = useState("");
  const [newSpacePin, setNewSpacePin] = useState("");
  const [deletePin, setDeletePin] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [managePin, setManagePin] = useState("");
  const { data: session, refetch: refetchSession } = authClient.useSession();
  
  // Avatar states
  const [customAvatarUrl, setCustomAvatarUrl] = useState("");
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  // Fetch Google avatar from server (decoded from stored idToken, no OAuth needed)
  const googleAvatar = trpc.space.getGoogleAvatar.useQuery(undefined, {
    staleTime: Infinity, // the Google photo URL doesn't change often
  });

  const displayAvatars = [
    ...(googleAvatar.data?.url ? [googleAvatar.data.url] : []),
    ...PRESET_AVATARS,
  ];

  function handleSpaceSwitch(spaceId: string) {
    const maxAge = 60 * 60 * 24 * 365;
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `active_space_id=${spaceId}; path=/; max-age=${maxAge}; SameSite=Lax${secure}`;
    // Force a full TRPC cache invalidate and React refresh to use the new space context
    utils.invalidate();
    router.refresh();
  }

  useEffect(() => {
    if (mine.data) {
      setName(mine.data.name);
      setActivePreset(resolveThemeKey(mine.data.themePreset));
    }
    if (mine.isSuccess && mine.data === null) router.replace("/onboarding");
  }, [mine.data, mine.isSuccess, router]);

  const updateTheme = trpc.space.updateTheme.useMutation({
    onSuccess: () => {
      utils.space.getMine.invalidate();
      utils.space.getAllMine.invalidate();
      toast("Đã lưu thiết lập giao diện", "success");
    },
    onError: (err) => toast(err.message, "error")
  });
  const createInvite = trpc.space.createInvite.useMutation({
    onSuccess: (d) => { setInvite(d.code); toast("Đã tạo mã mời", "success"); },
    onError: (err) => toast(err.message, "error")
  });
  const createSpace = trpc.space.create.useMutation({
    onSuccess: (data) => { toast("Đã tạo không gian", "success"); handleSpaceSwitch(data.id); },
    onError: (err) => toast(err.message, "error")
  });
  const joinSpace = trpc.space.joinByCode.useMutation({
    onSuccess: (data) => { toast("Đã tham gia không gian", "success"); handleSpaceSwitch(data.id); },
    onError: (err) => toast(err.message, "error")
  });
  const deleteSpace = trpc.space.delete.useMutation({
    onSuccess: () => {
      toast("Đã xoá không gian", "success");
      // Find another space to switch to
      const nextSpace = allMine.data?.find(s => s.id !== mine.data?.id);
      if (nextSpace) {
        handleSpaceSwitch(nextSpace.id);
      } else {
        document.cookie = `active_space_id=; path=/; max-age=0`;
        utils.space.getMine.setData(undefined, null);
        window.location.assign("/onboarding");
      }
    },
    onError: (err) => toast(err.message, "error")
  });
  const setSpacePin = trpc.space.setPin.useMutation({
    onSuccess: () => {
      utils.space.getMine.invalidate();
      setManagePin("");
      toast("Đã cập nhật mã PIN", "success");
    },
    onError: (err) => toast(err.message, "error")
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
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pt-12 pb-12 md:px-[30px] short:gap-4 short:pt-5 short:pb-6">
      <h1 className="text-2xl font-semibold">Cài đặt</h1>

      <h2 className="text-lg font-semibold mt-2">Hồ sơ</h2>

      {/* ── HỒ SƠ ── */}
      <Card className="space-y-4 shadow-sm">
        <p className="text-sm font-semibold text-accent">
          {full ? "Hồ sơ thành viên" : "Hồ sơ cá nhân"}
        </p>
        
        <div className="flex flex-col gap-4">
          {full && mine.data.membersData ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {mine.data.membersData.map((member: { id: string; name: string; email: string; image?: string | null }) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border bg-card/50 p-3 shadow-sm">
                  <img 
                    src={member.image || PRESET_AVATARS[0]} 
                    alt={member.name} 
                    className="h-14 w-14 shrink-0 rounded-full border-2 border-border object-cover bg-muted"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-medium truncate">{member.name}</p>
                      {member.id === session?.user.id && (
                        <span className="shrink-0 bg-accent-soft text-accent text-[10px] px-2 py-0.5 rounded-full font-medium">Bạn</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-4 rounded-xl border border-border bg-card/50 p-3 shadow-sm w-fit pr-8">
              <img 
                src={session?.user.image || PRESET_AVATARS[0]} 
                alt="Avatar" 
                className="h-14 w-14 rounded-full border-2 border-border object-cover bg-muted"
              />
              <div>
                <p className="font-medium">{session?.user.name}</p>
                <p className="text-sm text-muted-foreground">{session?.user.email}</p>
              </div>
            </div>
          )}
          
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">Đổi ảnh đại diện của bạn</p>
            {/* Capped: a six-column grid across a 1150px settings column left
                ~150px of dead space between each 40px avatar. */}
            <div className="grid max-w-md grid-cols-5 gap-2 sm:grid-cols-6 sm:gap-3">
              {displayAvatars.map((url, idx) => (
                <button
                  key={url + idx}
                  onClick={async () => {
                    setIsUpdatingAvatar(true);
                    const res = await authClient.updateUser({ image: url });
                    if (res.error) {
                      toast(res.error.message || "Lỗi khi cập nhật ảnh", "error");
                      setIsUpdatingAvatar(false);
                    } else {
                      toast("Đã cập nhật ảnh đại diện", "success");
                      await Promise.all([
                        utils.space.getMine.invalidate(),
                        utils.space.getAllMine.invalidate(),
                        refetchSession(),
                      ]);
                      router.refresh();
                      setIsUpdatingAvatar(false);
                    }
                  }}
                  disabled={isUpdatingAvatar}
                  className={cn(
                    "relative h-10 w-10 rounded-full border-2 transition-all hover:scale-105 active:scale-95 bg-muted touch-manipulation sm:h-12 sm:w-12",
                    session?.user.image === url ? "border-accent ring-2 ring-accent/20 ring-offset-1" : "border-transparent hover:border-border"
                  )}
                >
                  <img src={url} alt="Preset" className="h-full w-full rounded-full object-cover" />
                </button>
              ))}
            </div>
          </div>
          
          <div className="space-y-2 pt-2 border-t border-border">
            <p className="text-xs font-medium text-muted-foreground">Hoặc dùng link ảnh khác</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="Dán link ảnh (https://...)"
                value={customAvatarUrl}
                onChange={(e) => setCustomAvatarUrl(e.target.value)}
              />
              <Button
                variant="outline"
                className="w-full whitespace-nowrap touch-manipulation sm:w-auto"
                disabled={!customAvatarUrl.trim() || isUpdatingAvatar}
                onClick={async () => {
                  setIsUpdatingAvatar(true);
                  const res = await authClient.updateUser({ image: customAvatarUrl.trim() });
                  if (res.error) {
                    toast(res.error.message || "Lỗi khi cập nhật ảnh", "error");
                    setIsUpdatingAvatar(false);
                  } else {
                    toast("Đã cập nhật ảnh đại diện", "success");
                    await Promise.all([
                      utils.space.getMine.invalidate(),
                      utils.space.getAllMine.invalidate(),
                      refetchSession(),
                    ]);
                    router.refresh();
                    setIsUpdatingAvatar(false);
                    setCustomAvatarUrl("");
                  }
                }}
              >
                {isUpdatingAvatar ? "Đang lưu..." : "Lưu ảnh"}
              </Button>
            </div>
            
            <div className="pt-2">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Tài khoản liên kết</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button 
                  variant="outline" 
                  className="flex h-10 items-center gap-2 touch-manipulation w-full sm:w-auto text-sm"
                  onClick={() => {
                    authClient.linkSocial({
                      provider: "google",
                      callbackURL: "/settings",
                    }).then((res) => {
                      if (res.error) toast(res.error.message || "Đã xảy ra lỗi", "error");
                    });
                  }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                    <path d="M1 1h22v22H1z" fill="none" />
                  </svg>
                  Liên kết với Google
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Mẹo: Liên kết Google để sau này có thể đăng nhập bằng cả Email/Mật khẩu hoặc Google.
              </p>
            </div>
          </div>
        </div>
      </Card>

      <h2 className="text-lg font-semibold mt-2">Không gian chung</h2>
      <p className="text-muted-foreground -mt-4 text-sm">
        Nếu bạn ở nhiều không gian (vd nhiều cặp/nhóm), chọn không gian đang dùng.
      </p>

      {/* ── QUẢN LÝ KHÔNG GIAN ── */}
      <Card className="space-y-4 shadow-sm">
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
          <div className="space-y-2">
            <Input
              placeholder="Tên không gian"
              value={newSpaceName}
              onChange={(e) => setNewSpaceName(e.target.value)}
            />
            <Input
              placeholder="Mã PIN để xoá không gian sau này (nhớ kỹ nhé)"
              value={newSpacePin}
              onChange={(e) => setNewSpacePin(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full"
              disabled={createSpace.isPending || !newSpaceName.trim()}
              onClick={() => createSpace.mutate({ name: newSpaceName.trim(), pin: newSpacePin.trim() })}
            >
              {createSpace.isPending ? "Đang tạo..." : "Tạo không gian trống mới"}
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-border space-y-2">
          <p className="text-sm font-medium">Tham gia bằng mã mời</p>
          <p className="text-xs text-muted-foreground">
            Bạn của bạn tạo mã mời rồi gửi cho bạn — dán vào đây.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Nhập mã mời"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <Button
              disabled={!joinCode.trim() || joinSpace.isPending}
              onClick={() => joinSpace.mutate({ code: joinCode.trim() })}
              className="w-full whitespace-nowrap touch-manipulation sm:w-auto"
            >
              Tham gia
            </Button>
          </div>
          {joinSpace.isError && <p className="text-xs text-destructive">{joinSpace.error.message}</p>}
        </div>
      </Card>

      <h2 className="text-lg font-semibold mt-2">Giao diện</h2>

      <Card className="space-y-3">
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
        <div className="grid grid-cols-6 gap-3 sm:gap-2">
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
                  "h-10 w-10 rounded-full transition-all active:scale-90 touch-manipulation sm:h-9 sm:w-9",
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
        <p className="text-sm font-medium">Mời người đồng hành</p>
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
            <p className="text-xs text-muted-foreground">Mã dùng 1 lần, hết hạn sau 7 ngày.</p>
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

      {mine.data && !mine.data.isPersonal && mine.data.createdBy === session?.user.id && (
        <>
        <h2 className="text-lg font-semibold mt-2 text-destructive">Vùng nguy hiểm</h2>

        {/* Set / change / clear the delete-PIN — so a space created without one
            (e.g. via onboarding) can be protected later. */}
        <Card className="space-y-3">
          <p className="text-sm font-medium">Mã PIN xoá không gian</p>
          <p className="text-xs text-muted-foreground">
            {mine.data.hasPin
              ? "Đang có mã PIN. Nhập mã mới để đổi, hoặc để trống rồi lưu để gỡ mã."
              : "Chưa đặt mã PIN. Đặt mã để cần mã khi xoá; nếu không, xoá sẽ cần gõ đúng tên không gian."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              placeholder={mine.data.hasPin ? "Mã PIN mới (để trống = gỡ)" : "Đặt mã PIN"}
              value={managePin}
              onChange={(e) => setManagePin(e.target.value)}
            />
            <Button
              variant="outline"
              className="w-full whitespace-nowrap touch-manipulation sm:w-auto"
              disabled={setSpacePin.isPending}
              onClick={() => setSpacePin.mutate({ pin: managePin.trim() })}
            >
              {setSpacePin.isPending ? "Đang lưu…" : "Lưu mã PIN"}
            </Button>
          </div>
          {setSpacePin.isSuccess && <p className="text-xs text-accent">Đã cập nhật mã PIN ✓</p>}
          {setSpacePin.isError && <p className="text-xs text-destructive">{setSpacePin.error.message}</p>}
        </Card>

        <Card className="space-y-3 border-destructive">
          <p className="text-sm font-medium text-destructive">Xoá không gian</p>
          <p className="text-xs text-muted-foreground">
            Chỉ người tạo mới có thể xoá. Toàn bộ địa điểm, kỷ niệm, lịch… của không gian này sẽ bị xoá vĩnh viễn.
          </p>
          {mine.data.hasPin ? (
            <>
              <p className="text-xs text-muted-foreground">Nhập mã PIN đã đặt để xác nhận.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="password"
                  placeholder="Nhập mã PIN"
                  value={deletePin}
                  onChange={(e) => setDeletePin(e.target.value)}
                />
                <Button
                  variant="destructive"
                  className="w-full whitespace-nowrap touch-manipulation sm:w-auto"
                  disabled={deleteSpace.isPending || !deletePin.trim()}
                  onClick={() => deleteSpace.mutate({ pin: deletePin.trim() })}
                >
                  Xoá không gian
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Gõ đúng tên <span className="font-medium text-foreground">“{mine.data.name}”</span> để xác nhận xoá.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  placeholder="Nhập tên không gian"
                  value={confirmName}
                  onChange={(e) => setConfirmName(e.target.value)}
                />
                <Button
                  variant="destructive"
                  className="w-full whitespace-nowrap touch-manipulation sm:w-auto"
                  disabled={deleteSpace.isPending || confirmName.trim() !== mine.data.name.trim()}
                  onClick={() => deleteSpace.mutate({ confirmName: confirmName.trim() })}
                >
                  Xoá không gian
                </Button>
              </div>
            </>
          )}
          {deleteSpace.isError && <p className="text-xs text-destructive">{deleteSpace.error.message}</p>}
        </Card>
        </>
      )}

      <ConfirmButton
        title="Đăng xuất"
        description="Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không?"
        confirmText="Đăng xuất"
        idle="Đăng xuất"
        icon={<LogOut className="h-4 w-4" />}
        onConfirm={async () => {
          // Clear all cached tRPC/React-Query data so the next login doesn't
          // see stale space data from this user (race: SpaceGuard reads the
          // still-fresh cache before refetch → briefly shows app chrome).
          queryClient.clear();
          await authClient.signOut();
          router.replace("/sign-in");
        }}
        className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-destructive bg-card text-sm font-medium text-destructive shadow-sm transition-all hover:bg-destructive hover:!text-white active:scale-[0.98] !no-underline"
      />
    </div>
  );
}
