import {
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CornerUpLeft,
  CornerUpRight,
  Flag,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import type { ManeuverArrow } from "@/lib/maneuver-vi";

/**
 * The turn, as a shape.
 *
 * Read before the words are: at 40km/h the arrow is what actually gets used, so
 * each kind of turn gets a distinguishable outline rather than one arrow rotated
 * by a few degrees. Slight turns lean, real turns hook, and a U-turn and a
 * roundabout are their own symbols — the three that are most dangerous to
 * mistake for each other.
 */
const ICONS: Record<ManeuverArrow, typeof ArrowUp> = {
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  "slight-left": ArrowUpLeft,
  "slight-right": ArrowUpRight,
  "sharp-left": CornerUpLeft,
  "sharp-right": CornerUpRight,
  uturn: RotateCcw,
  roundabout: RefreshCw,
  destination: Flag,
};

export function ManeuverArrowIcon({
  arrow,
  className,
}: {
  arrow: ManeuverArrow;
  className?: string;
}) {
  const Icon = ICONS[arrow];
  return <Icon className={className} aria-hidden="true" strokeWidth={2.5} />;
}
