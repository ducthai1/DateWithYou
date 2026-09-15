"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, CloudRain, Loader2, MapPin, Navigation, Sparkles, Users, Wallet } from "lucide-react";
import { PageShell, PageHeader } from "@/components/layout/page-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { TimePicker } from "@/components/ui/time-picker";
import { useToast } from "@/components/ui/toast";
import { trpc } from "@/lib/trpc";
import { readableFormError } from "@/lib/form-error";
import { todayKey } from "@/lib/date-keys";
import { haversineM } from "@/lib/route-geometry";
import { BUDGET_KEYS, BUDGET_LABELS, type BudgetKey } from "@/lib/day-planner-taxonomy";
import { Chip, ChipRow, toggleIn } from "./plan-chips";
import { PlanStopCard, moneyBand } from "./plan-stop-card";
import { PlanPreviewMap, type PreviewPin } from "./plan-preview-map";

/**
 * "Hôm nay đi đâu?" — the screen the product is named after.
 *
 * Three steps, and the first one has to be answerable with one thumb. Somebody
 * arriving here has already said they cannot decide; a form is the wrong thing
 * to show them. So the first screen is one question and three chips, the
 * biggest of which is "don't ask me anything".
 *
 * Nothing on this screen is saved until Chốt. The person can regenerate, swap
 * and drop stops as often as they like, and their space is untouched — that is
 * enforced on the server, and is why the places Google found live in component
 * state here rather than as rows.
 */

type Draft = Extract<
  Awaited<ReturnType<ReturnType<typeof trpc.dayPlan.generate.useMutation>["mutateAsync"]>>,
  { ok: true }
>;
type Stop = Draft["stops"][number];

/** The activity kinds a person may ask for, in their own words. */
const KIND_CHIPS = [
  { key: "meal", label: "Ăn uống 🍜" },
  { key: "cafe", label: "Cà phê ☕" },
  { key: "entertain", label: "Giải trí 🎬" },
  { key: "stroll", label: "Đi dạo 🌳" },
  { key: "drink", label: "Lai rai 🍻" },
] as const;

/** The nearest half hour — a start time nobody has to think about. */
function nowRounded(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Ask the browser where we are, and never block on the answer. */
function askPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 300_000 },
    );
  });
}

export function DayPlanScreen() {
  const router = useRouter();
  const toast = useToast();
  const config = trpc.location.getConfig.useQuery();
  const generate = trpc.dayPlan.generate.useMutation();
  const confirm = trpc.dayPlan.confirm.useMutation();
  const invite = trpc.location.sendNavInvite.useMutation();

  const [step, setStep] = useState<"intro" | "tuning" | "result">("intro");
  const [areas, setAreas] = useState<string[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [budget, setBudget] = useState<BudgetKey>("tuy-y");
  const [startAt, setStartAt] = useState(nowRounded());
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);

  const [stops, setStops] = useState<Stop[]>([]);
  const [meta, setMeta] = useState<
    { seed: string; needsMorePlaces: boolean; weatherNote: string | null } | null
  >(null);
  const [outOfHours, setOutOfHours] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{ tripId: string; locationIds: string[] } | null>(null);

  const date = todayKey();

  /*
   * `startAt` may be passed in, and that is not a convenience.
   *
   * The out-of-hours card sets the new time and asks for a plan in the same
   * handler — and the `run` that handler closed over still holds the OLD time,
   * so "Lên kế hoạch từ 14:00" quietly asked for 22:00 again and was refused
   * again. The state update is still made, for the screen; the request uses
   * the value directly.
   */
  const run = useCallback(
    async (opts: { useLocation: boolean; seed?: string; startAt?: string }) => {
      const at = opts.startAt ?? startAt;
      setOutOfHours(null);
      setConfirmed(null);
      let where = origin;
      if (opts.useLocation && !where) {
        where = await askPosition();
        setOrigin(where);
      }
      try {
        const out = await generate.mutateAsync({
          date,
          startAt: at,
          areas,
          kinds: kinds as Stop["kind"][],
          budget,
          origin: where,
          seed: opts.seed ?? String(Date.now()),
        });
        if (!out.ok) {
          setOutOfHours(out.nextStartAt);
          setStep("result");
          return;
        }
        setStops(out.stops);
        setMeta({
          seed: out.seed,
          needsMorePlaces: out.needsMorePlaces,
          weatherNote: out.weatherNote,
        });
        setStep("result");
      } catch (err) {
        toast(readableFormError((err as Error).message, "Chưa lên được kế hoạch"), "error");
      }
    },
    [areas, budget, date, generate, kinds, origin, startAt, toast],
  );

  /** Swap one stop for the next candidate, and keep the old one in the queue. */
  const swap = (i: number) => {
    setStops((prev) =>
      prev.map((s, idx) => {
        if (idx !== i || !s.alternatives.length) return s;
        const [next, ...rest] = s.alternatives;
        const previousGeo = prev.slice(0, idx).reverse().find((p) => p.geo)?.geo ?? null;
        const old = {
          title: s.title, reason: s.reason, category: s.category, district: s.district,
          geo: s.geo, rating: s.rating, mustTry: s.mustTry, cost: s.cost,
          locationId: s.locationId, suggestion: s.suggestion, kind: s.kind,
        };
        return {
          ...s,
          title: next.title,
          reason: next.reason,
          category: next.category,
          district: next.district,
          geo: next.geo,
          rating: next.rating,
          mustTry: next.mustTry,
          cost: next.cost,
          locationId: next.locationId,
          suggestion: next.suggestion,
          // Recomputed rather than dropped: a card that stops saying how far it
          // is looks broken, and the maths is a straight line either way.
          travelM:
            previousGeo && next.geo ? Math.round(haversineM(previousGeo, next.geo)) : null,
          // The one we just left goes to the back, so tapping round returns.
          alternatives: [...rest, old] as Stop["alternatives"],
        };
      }),
    );
  };

  const drop = (i: number) => setStops((prev) => prev.filter((_, idx) => idx !== i));

  const kept = useMemo(() => stops.filter((s) => !s.unfilled), [stops]);
  const band = useMemo(
    () => kept.reduce((a, s) => ({ min: a.min + s.cost.min, max: a.max + s.cost.max }), { min: 0, max: 0 }),
    [kept],
  );
  const pins: PreviewPin[] = useMemo(
    () =>
      kept
        .filter((s) => s.geo)
        .map((s, i) => ({
          key: `${i}-${s.title}`,
          label: s.title,
          geo: s.geo!,
          suggested: !!s.suggestion,
        })),
    [kept],
  );

  async function onConfirm() {
    try {
      const out = await confirm.mutateAsync({
        date,
        stops: kept.map((s) => ({
          kind: s.kind,
          startTime: s.startTime,
          title: s.title,
          locationId: s.locationId,
          suggestion: s.suggestion ?? undefined,
          cost: Math.round((s.cost.min + s.cost.max) / 2),
        })),
      });
      setConfirmed({ tripId: out.tripId, locationIds: out.locationIds });
      toast(out.alreadyConfirmed ? "Kế hoạch này đã có sẵn rồi" : "Đã chốt kế hoạch hôm nay ✓", "success");
    } catch (err) {
      toast(readableFormError((err as Error).message, "Chưa chốt được"), "error");
    }
  }

  const busy = generate.isPending;

  return (
    <PageShell
      header={
        <PageHeader
          title="Hôm nay đi đâu?"
          subtitle="Không cần nghĩ. Bấm một cái, có ngay một buổi cụ thể."
          art="tripPlanner"
        />
      }
    >
      {step === "intro" && (
        <div className="mx-auto max-w-xl space-y-6 py-6 text-center">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold leading-tight sm:text-3xl">
              Chán rồi, không biết đi đâu?
            </h2>
            <p className="text-muted-foreground text-sm">
              Mình lo phần nghĩ. Bạn chỉ việc đi.
            </p>
          </div>

          <div className="flex flex-col items-stretch gap-3">
            {/*
              The biggest button is the one that asks for nothing. Anything
              else as the primary action would contradict the sentence above
              it — and the name of the app.
            */}
            <Button
              onClick={() => run({ useLocation: true })}
              disabled={busy}
              className="h-14 text-base"
            >
              {busy ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-5 w-5" />
              )}
              Cứ đi thôi, tôi không chọn gì
            </Button>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12 flex-1"
                disabled={busy}
                onClick={() => run({ useLocation: true })}
              >
                <MapPin className="mr-1.5 h-4 w-4" /> Quanh đây
              </Button>
              <Button
                variant="outline"
                className="h-12 flex-1"
                disabled={busy}
                onClick={() => setStep("tuning")}
              >
                Tôi có ý rồi
              </Button>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            Ưu tiên những chỗ hai người đã lưu. Chưa lưu gì thì mình gợi ý thêm.
          </p>
        </div>
      )}

      {step === "tuning" && (
        <div className="mx-auto max-w-xl space-y-6 py-2">
          <ChipRow title="Quanh khu nào?" hint="Bỏ trống là đâu cũng được">
            {(config.data?.districts ?? []).map((d) => (
              <Chip
                key={d}
                label={d}
                selected={areas.includes(d)}
                onClick={() => setAreas((p) => toggleIn(p, d))}
              />
            ))}
          </ChipRow>

          <ChipRow title="Muốn làm gì?" hint="Chọn nhiều cũng được">
            {KIND_CHIPS.map((k) => (
              <Chip
                key={k.key}
                label={k.label}
                selected={kinds.includes(k.key)}
                onClick={() => setKinds((p) => toggleIn(p, k.key))}
              />
            ))}
          </ChipRow>

          <ChipRow title="Ngân sách" hint="Mình chỉ đưa khoảng, không hứa con số">
            {BUDGET_KEYS.map((b) => (
              <Chip
                key={b}
                label={BUDGET_LABELS[b]}
                selected={budget === b}
                onClick={() => setBudget(b)}
              />
            ))}
          </ChipRow>

          <div className="space-y-2">
            <p className="text-sm font-semibold">Bắt đầu lúc</p>
            <div className="max-w-[10rem]">
              <TimePicker value={startAt} onChange={(v) => setStartAt(v || nowRounded())} />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="ghost" className="flex-1" onClick={() => setStep("intro")}>
              Quay lại
            </Button>
            <Button className="flex-[2]" disabled={busy} onClick={() => run({ useLocation: true })}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lên kế hoạch
            </Button>
          </div>
        </div>
      )}

      {step === "result" && (
        <div className="mx-auto max-w-xl space-y-5 py-2">
          {busy ? (
            /*
             * A plan being fetched is not a plan with nothing in it.
             *
             * Asking again clears the previous answer first, and for the
             * second that took, the screen showed "Kế hoạch chiều nay · 0
             * chặng · 0đ" with a Chốt button under it — which reads as the
             * app having failed, not as it working. Found by the e2e, which
             * pressed Chốt during exactly that gap.
             */
            <div className="space-y-3 py-10 text-center">
              <Loader2 className="text-accent mx-auto h-8 w-8 animate-spin" aria-hidden />
              <p className="text-muted-foreground text-sm">Đang xếp một buổi cho bạn…</p>
            </div>
          ) : outOfHours ? (
            <EmptyState
              art="emptyCompass"
              icon="clock"
              title="Giờ này hơi khuya để lên kế hoạch"
              subtitle={`Mình lên kế hoạch cho buổi chiều và buổi tối. Thử lại từ ${outOfHours} nhé.`}
              action={{
                label: `Lên kế hoạch từ ${outOfHours}`,
                onClick: () => {
                  setStartAt(outOfHours);
                  void run({ useLocation: true, startAt: outOfHours });
                },
              }}
            />
          ) : meta?.needsMorePlaces ? (
            /*
              The arrival path from the two SEO pages lands here: a brand-new
              space with nothing saved. "Hết lượt" or an error would lose the
              person who came looking for exactly this. A first step is better
              than a dead end.
            */
            <EmptyState
              art="emptyMap"
              icon="map-pin"
              title="Thêm vài chỗ bạn thích là mình lên kế hoạch được ngay"
              subtitle="Ba chỗ thôi — một quán cà phê, một chỗ ăn, một chỗ đi dạo — là đủ cho một buổi chiều."
              action={{ label: "Thêm địa điểm", onClick: () => router.push("/map") }}
            />
          ) : (
            <>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Kế hoạch chiều nay</p>
                  <p className="text-muted-foreground text-xs">
                    {kept.length} chặng · bắt đầu {stops[0]?.startTime ?? startAt}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-sm font-semibold tabular-nums">
                  <Wallet className="h-4 w-4" aria-hidden />
                  {moneyBand(band)}
                </p>
                {/* Only when there is something to say. A forecast line on a
                    dry afternoon is noise. */}
                {meta?.weatherNote && (
                  <p className="text-muted-foreground flex w-full items-center gap-1.5 text-xs">
                    <CloudRain className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    {meta.weatherNote}
                  </p>
                )}
              </Card>

              {pins.length > 0 && <PlanPreviewMap pins={pins} />}

              <div className="space-y-3">
                {stops.map((s, i) => (
                  <PlanStopCard
                    key={`${i}-${s.startTime}-${s.title}`}
                    stop={s}
                    index={i}
                    canSwap={s.alternatives.length > 0}
                    onSwap={() => swap(i)}
                    onDrop={() => drop(i)}
                  />
                ))}
              </div>

              {confirmed ? (
                <Card className="space-y-3">
                  <p className="font-semibold">Đã chốt ✓</p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/calendar?date=${date}`}
                      className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
                    >
                      <CalendarDays className="h-4 w-4" /> Xem trong lịch
                    </Link>
                    {confirmed.locationIds[0] && (
                      <>
                        <Link
                          href="/map"
                          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
                        >
                          <Navigation className="h-4 w-4" /> Chỉ đường chặng 1
                        </Link>
                        <button
                          type="button"
                          disabled={invite.isPending}
                          onClick={() =>
                            invite.mutate(
                              { locationId: confirmed.locationIds[0], locationName: kept[0]?.title ?? "" },
                              {
                                onSuccess: () => toast("Đã rủ người kia đi cùng", "success"),
                                onError: (e) => toast(readableFormError(e.message), "error"),
                              },
                            )
                          }
                          className="border-border hover:bg-muted inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm"
                        >
                          <Users className="h-4 w-4" /> Rủ người kia
                        </button>
                      </>
                    )}
                  </div>
                </Card>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="outline"
                    className="sm:flex-1"
                    disabled={busy}
                    onClick={() => run({ useLocation: false })}
                  >
                    {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Đổi kế hoạch khác
                  </Button>
                  <Button
                    className="sm:flex-[2]"
                    disabled={confirm.isPending || kept.length === 0}
                    onClick={onConfirm}
                  >
                    {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Chốt kế hoạch này
                  </Button>
                </div>
              )}

              {/* A bare text link is a 20px target on a phone. Padded to a
                  real one — the e2e measures every control on this screen. */}
              <button
                type="button"
                onClick={() => setStep("tuning")}
                className="text-muted-foreground hover:text-accent mx-auto block px-4 py-3 text-sm underline underline-offset-4"
                style={{ minHeight: 44 }}
              >
                Chỉnh lại khu vực, ngân sách, giờ bắt đầu
              </button>
            </>
          )}
        </div>
      )}
    </PageShell>
  );
}
