import {
  CheckCircle2,
  GraduationCap,
  Home,
  Lightbulb,
  Map,
  Plane,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { PlanCategory } from "@/lib/plan-ideas";

export type PlanStatus = "idea" | "planning" | "done";

/** `short` names the column inside the form's three-way switch, where 390px holds three words, not five. */
export const PLAN_COLUMNS = [
  // spot: a wide scene here would crop to a smear at 1/3-column width (md+),
  // so each empty column gets a spot illustration picked for what the status
  // means instead — a daydream, a booked plan, a trip already made.
  { key: "idea" as const, label: "Ý tưởng", short: "Ý tưởng", icon: Lightbulb, bg: "bg-amber-500/10 border-amber-500/20", iconColor: "text-amber-600", spot: "islandCampsite" as const },
  { key: "planning" as const, label: "Đang lên kế hoạch", short: "Lên kế hoạch", icon: Map, bg: "bg-sky-500/10 border-sky-500/20", iconColor: "text-sky-600", spot: "pinTicket" as const },
  { key: "done" as const, label: "Đã làm", short: "Đã làm", icon: CheckCircle2, bg: "bg-emerald-500/10 border-emerald-500/20", iconColor: "text-emerald-600", spot: "backpackScrapbook" as const },
];

/** The next column a card moves to with one tap — the phone's stand-in for dragging. */
export const NEXT_STATUS: Record<PlanStatus, { to: PlanStatus; label: string } | null> = {
  idea: { to: "planning", label: "Lên kế hoạch" },
  planning: { to: "done", label: "Đã làm" },
  done: null,
};

export const PLAN_CATEGORY_ICON: Record<PlanCategory, LucideIcon> = {
  "Du lịch": Plane,
  "Ăn uống": UtensilsCrossed,
  "Trải nghiệm": Sparkles,
  "Mua sắm": ShoppingBag,
  "Học cùng nhau": GraduationCap,
  "Tổ ấm": Home,
};

export function planCategoryIcon(category: string | null | undefined): LucideIcon | undefined {
  return category ? PLAN_CATEGORY_ICON[category as PlanCategory] : undefined;
}
