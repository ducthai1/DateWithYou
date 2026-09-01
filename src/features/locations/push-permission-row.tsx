"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Same conversion as the silent re-registration; see push-setup.tsx. */
function urlBase64ToBytes(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const normalised = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalised);
  const buffer = new ArrayBuffer(raw.length);
  const out = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return buffer;
}

/**
 * The switch that asks for notification permission.
 *
 * Asking lives here, behind a press, rather than on page load: a prompt that
 * arrives unexplained is refused by reflex, and a refusal is close to permanent
 * — browsers will not ask again, and the person has to find it in site settings.
 * So the copy says what it is for before the system dialog appears.
 *
 * The iOS note is not a detail. Safari grants push to installed web apps only,
 * so on an iPhone still using the app in a Safari tab this cannot work at all,
 * and saying so is better than a switch that fails silently.
 */
export function PushPermissionRow() {
  const toast = useToast();
  const available = trpc.push.available.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const subscribe = trpc.push.subscribe.useMutation();
  const unsubscribe = trpc.push.unsubscribe.useMutation();

  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    void navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {});
  }, []);

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  // Nothing to offer if the server cannot send or the browser cannot receive.
  if (permission === "unsupported" || !key || available.data?.enabled === false) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast("Bạn đã từ chối thông báo — bật lại trong cài đặt của trình duyệt nhé", "error");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToBytes(key),
        }));
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) throw new Error("no endpoint");
      await subscribe.mutateAsync({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setSubscribed(true);
      toast("Đã bật thông báo ✓", "success");
    } catch {
      toast("Không bật được thông báo, thử lại sau nhé", "error");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribe.mutateAsync({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setSubscribed(false);
      toast("Đã tắt thông báo trên máy này");
    } catch {
      toast("Không tắt được, thử lại sau nhé", "error");
    } finally {
      setBusy(false);
    }
  };

  const on = permission === "granted" && subscribed;

  return (
    <div className="space-y-3 w-full">
      <h3 className="font-medium text-foreground">Thông báo lời mời</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Bật để nhận lời mời đi chung ngay trên máy — kể cả khi đang khoá màn hình hoặc đang dùng app
        khác. Trên iPhone cần <span className="text-foreground font-medium">thêm app vào Màn hình
        chính</span> trước, Safari chỉ cho phép thông báo với app đã cài.
      </p>
      <Button
        type="button"
        variant={on ? "outline" : "primary"}
        onClick={() => void (on ? disable() : enable())}
        disabled={busy}
        className="gap-2"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : on ? (
          <BellOff className="h-4 w-4" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {on ? "Tắt thông báo trên máy này" : "Bật thông báo"}
      </Button>
      {permission === "denied" && (
        <p className="text-xs font-medium text-amber-600">
          Trình duyệt đang chặn thông báo cho trang này — mở cài đặt trang để cho phép lại.
        </p>
      )}
    </div>
  );
}
