"use client";

import { useCallback, useEffect, useState } from "react";
import { usePartnerName } from "@/features/space/use-partner";
import { Bell, BellOff, Loader2, Smartphone } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  ensurePushSubscription,
  isStandalone,
  pushBlocker,
  type PushBlocker,
} from "@/lib/push-subscribe";

/**
 * The switch that asks for notification permission — and, when it cannot, says
 * why instead of vanishing.
 *
 * Asking lives here, behind a press, rather than on page load: a prompt that
 * arrives unexplained is refused by reflex, and a refusal is close to permanent
 * — browsers will not ask again, and the person has to find it in site
 * settings. So the copy says what it is for before the system dialog appears.
 *
 * This component used to `return null` whenever push was unavailable, which
 * hid exactly the case that most needed explaining. Safari grants push only to
 * an installed web app, so on an iPhone using the app in a tab there was
 * nothing on screen at all — no switch, no note, no hint that "Thêm vào Màn
 * hình chính" is the missing step. Someone whose invites never arrived went
 * looking for the setting and found an empty space.
 */
export function PushPermissionRow() {
  const partnerName = usePartnerName();
  const toast = useToast();
  const status = trpc.push.available.useQuery(undefined, { retry: false, staleTime: 30_000 });
  const subscribe = trpc.push.subscribe.useMutation();
  const unsubscribe = trpc.push.unsubscribe.useMutation();

  const [blocker, setBlocker] = useState<PushBlocker | "loading">("loading");
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const [installed, setInstalled] = useState(false);
  /** "checking" until the service worker has actually been asked. */
  const [subscribed, setSubscribed] = useState<boolean | "checking">("checking");
  const [busy, setBusy] = useState(false);

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const register = subscribe.mutateAsync;

  /*
   * Reads the device, and repairs it when permission is already given but the
   * subscription is gone.
   *
   * That combination is the whole iOS complaint. Safari drops a web app's push
   * subscription across restarts far more readily than Chrome does, so on an
   * iPhone `getSubscription()` comes back null on a later visit even though
   * permission was granted in the morning. This used to report that as "not
   * subscribed" and put the switch back to "Bật thông báo" — asking someone to
   * re-enable something they never turned off. Android kept its subscription,
   * so the same code looked correct there.
   *
   * Re-subscribing needs no prompt once permission exists, so the repair is
   * silent. `PushSetup` does the same on load; whichever gets there first, the
   * other joins the same in-flight call. Reading alone was not enough: the row
   * read once at mount, before that load-time repair had finished, and never
   * looked again.
   */
  const readDevice = useCallback(async () => {
    const block = pushBlocker();
    setBlocker(block);
    setInstalled(isStandalone());
    const perm = "Notification" in window ? Notification.permission : null;
    setPermission(perm);
    if (!("serviceWorker" in navigator)) return setSubscribed(false);
    try {
      /*
       * `ready` never resolves when no worker ever registers — a private
       * window, a blocked registration, or dev, where the registration is
       * deliberately skipped. Waiting forever would park the switch on "đang
       * kiểm" with nothing to press, which is worse than the wrong label it
       * replaced. Give up and let the switch be usable: pressing it runs the
       * same sequence and can show a real error.
       */
      const reg = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
      if (!reg) return setSubscribed(false);
      const existing = await reg.pushManager?.getSubscription();
      if (existing) return setSubscribed(true);
      if (perm !== "granted" || block !== null || !key) return setSubscribed(false);

      const fresh = await ensurePushSubscription(key);
      await register({
        endpoint: fresh.endpoint,
        keys: fresh.keys,
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setSubscribed(true);
    } catch {
      // Could not tell, and could not repair. Saying "chưa" is the safe answer:
      // pressing the switch runs the same sequence with an error to show.
      setSubscribed(false);
    }
  }, [key, register]);

  useEffect(() => {
    void readDevice();
  }, [readDevice]);

  /*
   * An installed app resumes from the background rather than reloading, and on
   * iOS that is when a dropped subscription shows up. Check again on the way
   * back in.
   */
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void readDevice();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [readDevice]);

  const enable = async () => {
    if (!key) return;
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        toast("Bạn đã từ chối thông báo — bật lại trong cài đặt của trình duyệt nhé", "error");
        return;
      }
      const reg = await ensurePushSubscription(key);
      await subscribe.mutateAsync({
        endpoint: reg.endpoint,
        keys: reg.keys,
        userAgent: navigator.userAgent.slice(0, 300),
      });
      setSubscribed(true);
      await status.refetch();
      toast("Đã bật thông báo ✓", "success");
    } catch (err) {
      toast(
        `Không bật được thông báo: ${err instanceof Error ? err.message : "thử lại sau nhé"}`,
        "error",
      );
    } finally {
      setBusy(false);
      void readDevice();
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
      await status.refetch();
      toast("Đã tắt thông báo trên máy này");
    } catch {
      toast("Không tắt được, thử lại sau nhé", "error");
    } finally {
      setBusy(false);
      void readDevice();
    }
  };

  const checking = subscribed === "checking";
  const on = permission === "granted" && subscribed === true;

  return (
    <div className="w-full space-y-3">
      <h3 className="text-foreground font-medium">Thông báo lời mời</h3>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Bật để nhận lời mời đi chung ngay trên máy — kể cả khi đang khoá màn hình hoặc đang dùng app
        khác.
      </p>

      {blocker === "ios-needs-install" ? (
        /*
         * The instruction, not an apology. Apple gives push to installed web
         * apps only, and this is the whole of what someone on an iPhone has to
         * do — spelled out, because the menu item is not where anyone looks.
         */
        <div className="border-border bg-accent-soft/30 space-y-2 rounded-xl border p-3">
          <p className="text-foreground flex items-center gap-1.5 text-sm font-medium">
            <Smartphone className="h-4 w-4" /> Trên iPhone cần cài app vào Màn hình chính trước
          </p>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Safari chỉ cho phép thông báo với app đã cài. Trong Safari, chạm nút{" "}
            <strong className="text-foreground">Chia sẻ</strong> (hình vuông có mũi tên lên) →{" "}
            <strong className="text-foreground">Thêm vào MH chính</strong> → mở app từ biểu tượng vừa
            xuất hiện, rồi quay lại đây bật thông báo.
          </p>
        </div>
      ) : blocker === "denied" ? (
        <p className="text-sm font-medium text-amber-600">
          Trình duyệt đang chặn thông báo cho trang này. Mở cài đặt trang trong trình duyệt và cho
          phép lại — sau khi từ chối, trình duyệt sẽ không hỏi nữa.
        </p>
      ) : blocker === "unsupported" || blocker === "no-service-worker" ? (
        <p className="text-muted-foreground text-sm">
          Trình duyệt này không hỗ trợ thông báo đẩy. Thử Chrome trên Android, hoặc cài app vào Màn
          hình chính trên iPhone.
        </p>
      ) : status.data && !status.data.enabled ? (
        <p className="text-muted-foreground text-sm">
          Server chưa có khoá VAPID nên chưa gửi được thông báo. Cần thêm{" "}
          <code className="text-xs">NEXT_PUBLIC_VAPID_PUBLIC_KEY</code> và{" "}
          <code className="text-xs">VAPID_PRIVATE_KEY</code> rồi deploy lại.
        </p>
      ) : (
        <Button
          type="button"
          variant={on ? "outline" : "primary"}
          onClick={() => void (on ? disable() : enable())}
          disabled={busy || checking || blocker === "loading"}
          className="gap-2"
        >
          {busy || checking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : on ? (
            <BellOff className="h-4 w-4" />
          ) : (
            <Bell className="h-4 w-4" />
          )}
          {checking ? "Đang kiểm máy này…" : on ? "Tắt thông báo trên máy này" : "Bật thông báo"}
        </Button>
      )}

      {/*
        The four facts that decide whether a notification can arrive, on screen
        together. Every one of them was previously invisible, which is why
        "nothing arrived" had no next step.
      */}
      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt>Đã cài vào Màn hình chính</dt>
        <dd className="text-foreground font-medium">{installed ? "có" : "chưa"}</dd>
        <dt>Quyền thông báo</dt>
        <dd className="text-foreground font-medium">
          {permission === "granted"
            ? "đã cho phép"
            : permission === "denied"
              ? "đã chặn"
              : permission === "default"
                ? "chưa hỏi"
                : "không có"}
        </dd>
        <dt>Máy này đã đăng ký</dt>
        <dd className="text-foreground font-medium">
          {checking ? "đang kiểm…" : subscribed ? "có" : "chưa"}
        </dd>
        <dt>Server gửi được</dt>
        <dd className="text-foreground font-medium">
          {status.isLoading
            ? "đang kiểm…"
            : status.data
              ? status.data.enabled
                ? `có · bạn ${status.data.myDevices} máy · người kia ${status.data.partnerDevices} máy`
                : "chưa cấu hình khoá"
              : "không kiểm được"}
        </dd>
      </dl>

      {status.data?.enabled && status.data.partnerDevices === 0 && (
        <p className="text-xs leading-relaxed text-amber-600">
          {partnerName} chưa có máy nào đăng ký nhận thông báo — lời mời bạn gửi sẽ không hiện lên máy họ
          khi họ đóng app. Nhờ họ vào đây bật giúp nhé.
        </p>
      )}
    </div>
  );
}
