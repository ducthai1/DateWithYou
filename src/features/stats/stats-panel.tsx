"use client";

import { format } from "date-fns";
import {
  CalendarHeart,
  ChefHat,
  Heart,
  Hourglass,
  Images,
  Map,
  MapPin,
  Plane,
  RotateCw,
  type LucideIcon,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SpotArt } from "@/components/theme/tone-art";
import { cn } from "@/lib/utils";
import { StatCard } from "./stat-card";

const vi = (n: number) => n.toLocaleString("vi-VN");

/** "2025-03" → "Tháng 3/2025". */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `Tháng ${Number(month)}/${year}`;
}

type Tile = { key: string; Icon: LucideIcon; label: string; value: string; hint?: string };

/**
 * "Chúng mình" — shared counters for the couple.
 *
 * Every number here belongs to both of them. There is intentionally no
 * per-partner split, no "who added more", and no streak that can be broken:
 * this panel is meant to be re-read fondly, not scored. Tiles only appear once
 * they have something to remember, so an early space reads as a beginning
 * rather than a list of zeros.
 *
 * Drop it anywhere — Today screen, Settings — with `<StatsPanel />`.
 */
export function StatsPanel({ className }: { className?: string }) {
  const overview = trpc.stats.overview.useQuery();
  const data = overview.data;

  if (overview.isLoading) {
    return (
      <section className={cn("space-y-4", className)} aria-busy="true">
        <div className="space-y-2">
          <Skeleton variant="text" className="w-32" />
          <Skeleton variant="text" className="w-56" />
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  if (overview.isError) {
    return (
      <section
        className={cn(
          "border-border bg-card space-y-3 rounded-2xl border p-5 text-center",
          className,
        )}
      >
        <p className="font-medium">Chưa xem được con số của tụi mình</p>
        <p className="text-muted-foreground text-sm">
          Mạng đang hơi chậm thôi. Thử lại một lần nữa nhé.
        </p>
        <Button variant="outline" onClick={() => overview.refetch()}>
          <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Thử lại
        </Button>
      </section>
    );
  }

  if (!data) return null;

  const tiles: Tile[] = [];

  if (data.daysTogether !== null) {
    tiles.push({
      key: "days",
      Icon: Heart,
      label: "Ngày cùng nhau",
      value: vi(data.daysTogether),
      hint: data.anniversaryDate
        ? `từ ${format(new Date(data.anniversaryDate), "dd/MM/yyyy")}`
        : undefined,
    });
  }
  if (data.memories > 0) {
    tiles.push({
      key: "memories",
      Icon: Images,
      label: "Kỷ niệm đã lưu",
      value: vi(data.memories),
      hint: data.photos > 0 ? `${vi(data.photos)} tấm ảnh nằm trong đó` : undefined,
    });
  }
  if (data.placesPinned > 0) {
    tiles.push({
      key: "places",
      Icon: MapPin,
      label: "Chỗ đã ghim",
      value: vi(data.placesPinned),
      hint:
        data.placesVisited > 0
          ? `${vi(data.placesVisited)} chỗ đã ghé thật rồi`
          : "chờ ghé thử",
    });
  }
  if (data.districtsCovered > 0) {
    tiles.push({
      key: "districts",
      Icon: Map,
      label: "Quận đã đi qua",
      value: vi(data.districtsCovered),
      hint: "trên tấm bản đồ của tụi mình",
    });
  }
  if (data.trips > 0) {
    tiles.push({
      key: "trips",
      Icon: Plane,
      label: "Chuyến đi",
      value: vi(data.trips),
      hint:
        data.tripsCompleted > 0
          ? `${vi(data.tripsCompleted)} chuyến đã đi trọn`
          : "đang lên kế hoạch",
    });
  }
  if (data.recipes > 0) {
    tiles.push({
      key: "recipes",
      Icon: ChefHat,
      label: "Công thức đã lưu",
      value: vi(data.recipes),
      hint: "để nấu cho nhau ăn",
    });
  }
  if (data.capsulesSealed + data.capsulesOpened > 0) {
    tiles.push({
      key: "capsules",
      Icon: Hourglass,
      label: "Hộp thời gian",
      value: vi(data.capsulesSealed + data.capsulesOpened),
      hint: `${vi(data.capsulesSealed)} còn niêm phong · ${vi(data.capsulesOpened)} đã mở`,
    });
  }
  if (data.busiestMonth) {
    tiles.push({
      key: "busiest",
      Icon: CalendarHeart,
      label: "Tháng nhiều kỷ niệm nhất",
      value: monthLabel(data.busiestMonth.key),
      hint: `${vi(data.busiestMonth.count)} kỷ niệm trong tháng đó`,
    });
  }

  if (tiles.length === 0) {
    return (
      <section className={className}>
        <EmptyState
          icon="heart-handshake"
          art="emptyCanvas"
          title="Chúng mình mới bắt đầu thôi"
          subtitle="Lưu một kỷ niệm hay ghim một chỗ muốn đi, rồi những con số ở đây sẽ tự lớn lên."
          action={{ label: "Lưu kỷ niệm đầu tiên", href: "/timeline" }}
        />
      </section>
    );
  }

  const lead =
    data.memories > 0
      ? `Tụi mình đã lưu ${vi(data.memories)} kỷ niệm, và vẫn đang viết tiếp.`
      : "Một vài con số nho nhỏ của tụi mình.";

  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {/* This panel is dropped into other screens verbatim (see file
              banner), so the mark stays a small fixed 36px inline flourish
              rather than a background band that would fight whatever art
              the host screen already has above it. */}
          <div className="relative h-9 w-9 shrink-0" aria-hidden="true">
            <SpotArt name="starRibbon" sizes="36px" />
          </div>
          <h2 className="text-accent text-xl font-semibold">Chúng mình</h2>
        </div>
        <p className="text-muted-foreground text-sm">{lead}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <StatCard
            key={t.key}
            Icon={t.Icon}
            label={t.label}
            value={t.value}
            hint={t.hint}
          />
        ))}
      </div>
    </section>
  );
}
