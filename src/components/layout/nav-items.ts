import {
  Map,
  CalendarHeart,
  Images,
  Settings,
  Library,
  Plane,
  Sun,
  Bell,
  Search,
  type LucideIcon,
} from "lucide-react";

// Shared navigation source for both the mobile bottom nav and the desktop
// sidebar so the two never drift apart. `center` marks the hero tab (Lịch),
// rendered larger/raised on the mobile bottom nav.
export const NAV_ITEMS: {
  href: string;
  label: string;
  Icon: LucideIcon;
  center?: boolean;
  /** Kept out of the mobile bottom bar, which only has room for six targets
   *  at 390px. Still rendered in the desktop sidebar, and reachable on mobile
   *  from the top bar, so nothing is orphaned. */
  mobileHidden?: boolean;
}[] = [
  { href: "/calendar", label: "Lịch", Icon: CalendarHeart },
  { href: "/timeline", label: "Kỷ niệm", Icon: Images },
  // "Hôm nay" takes the raised centre slot: it is the screen a returning
  // visitor should land on, so it gets the bar's most reachable target.
  { href: "/home", label: "Hôm nay", Icon: Sun, center: true },
  { href: "/map", label: "Bản đồ", Icon: Map },
  { href: "/library", label: "Bộ sưu tập", Icon: Library },
  { href: "/trips", label: "Chuyến đi", Icon: Plane },
  // Reachable on mobile from the top bar (bell + search), so they stay out of
  // the bottom bar and only appear in the desktop sidebar.
  { href: "/search", label: "Tìm kiếm", Icon: Search, mobileHidden: true },
  { href: "/activity", label: "Hoạt động", Icon: Bell, mobileHidden: true },
  { href: "/settings", label: "Cài đặt", Icon: Settings, mobileHidden: true },
];

// Routes with no app chrome (landing, auth, onboarding).
export const NAV_HIDDEN_ON = ["/", "/sign-in", "/sign-up", "/onboarding", "/forgot-password", "/reset-password"];

// Where every successful login lands. Must be a SpaceGuard-protected feature
// route so the guard runs the "has a couple space? → stay in : → /onboarding"
// branch in one place — no auth flow re-implements that check.
//
// Previously "/map". A map is a browsing surface: it answers "where could we
// go", never "what happened while I was away". Returning partners landed with
// nothing addressed to them, so /home is the front door instead.
export const POST_LOGIN_REDIRECT = "/home";
