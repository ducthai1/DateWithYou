import {
  Coffee,
  UtensilsCrossed,
  Soup,
  Palette,
  Camera,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "./districts-categories";

/** Icon + colour tint per category so cards read at a glance instead of as text. */
export const CATEGORY_META: Record<
  Category,
  { Icon: LucideIcon; className: string }
> = {
  "Cà phê": { Icon: Coffee, className: "bg-amber-100 text-amber-700" },
  "Ăn tối": { Icon: UtensilsCrossed, className: "bg-rose-100 text-rose-700" },
  "Street food": { Icon: Soup, className: "bg-orange-100 text-orange-700" },
  Workshop: { Icon: Palette, className: "bg-violet-100 text-violet-700" },
  "Chụp ảnh": { Icon: Camera, className: "bg-sky-100 text-sky-700" },
  Khác: { Icon: MapPin, className: "bg-stone-200 text-stone-600" },
};
