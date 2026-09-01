import {
  Map,
  CalendarHeart,
  Images,
  Settings,
  Library,
  Bike,
  Plane,
  Sun,
  Bell,
  Search,
  type LucideIcon,
} from "lucide-react";
import { MARKETING_ROUTES } from "@/components/marketing/feature-pages/slugs";

// Shared navigation source for both the mobile bottom nav and the desktop
// sidebar so the two never drift apart. `center` marks the hero tab (Lịch),
// rendered larger/raised on the mobile bottom nav.
export const NAV_ITEMS: {
  href: string;
  label: string;
  Icon: LucideIcon;
  center?: boolean;
  /** Kept out of the mobile bottom bar. Still rendered in the desktop sidebar,
   *  and reachable on mobile from the top bar, so nothing is orphaned. */
  mobileHidden?: boolean;
}[] = [
  // Array order IS the order of the mobile bottom bar, left to right.
  { href: "/map", label: "Bản đồ", Icon: Map },
  { href: "/calendar", label: "Lịch", Icon: CalendarHeart },
  { href: "/timeline", label: "Kỷ niệm", Icon: Images },
  // "Hôm nay" takes the raised centre slot: it is the screen a returning
  // visitor should land on, so it gets the bar's most reachable target.
  { href: "/home", label: "Hôm nay", Icon: Sun, center: true },
  { href: "/trips", label: "Chuyến đi", Icon: Plane },
  // Moved down out of the top bar. What the other person adds is the reason to
  // come back, and a count is only useful where the thumb already is.
  { href: "/activity", label: "Hoạt động", Icon: Bell },
  { href: "/library", label: "Bộ sưu tập", Icon: Library },
  // Rides already taken. Desktop sidebar only: the bottom bar is full, and this
  // is a screen people visit to look back rather than one they reach for mid-trip.
  { href: "/rides", label: "Đã đi", Icon: Bike, mobileHidden: true },
  // Still reachable on mobile from the top bar, so they stay out of the bottom
  // bar and appear only in the desktop sidebar.
  { href: "/search", label: "Tìm kiếm", Icon: Search, mobileHidden: true },
  { href: "/settings", label: "Cài đặt", Icon: Settings, mobileHidden: true },
];

/*
 * Routes with no app chrome (marketing, auth, onboarding).
 *
 * Six components gate on this list — the header, both navs, the main wrapper,
 * the welcome modal, and SpaceGuard. Missing a public route here is not a
 * cosmetic bug: SpaceGuard reads `!NAV_HIDDEN_ON.includes(pathname)` as "this
 * page needs a space", so a visitor arriving from a search result gets bounced
 * to onboarding instead of reading the page they clicked.
 *
 * The slugs are spread in from their own module rather than typed out, so adding
 * a page cannot leave it out of this list. It has to be the slug module and not
 * the content registry: this file reaches eight client components, and pulling
 * the registry in shipped all four pages of marketing prose to every user.
 */
export const NAV_HIDDEN_ON = [
  ...MARKETING_ROUTES,
  "/sign-in",
  "/sign-up",
  "/onboarding",
  "/forgot-password",
  "/reset-password",
];

// Where every successful login lands. Must be a SpaceGuard-protected feature
// route so the guard runs the "has a space? → stay in : → /onboarding"
// branch in one place — no auth flow re-implements that check.
//
// Previously "/map". A map is a browsing surface: it answers "where could we
// go", never "what happened while I was away". Returning members landed with
// nothing addressed to them, so /home is the front door instead.
export const POST_LOGIN_REDIRECT = "/home";
