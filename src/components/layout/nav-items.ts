import { Map, CalendarHeart, Images, Lock, Library, type LucideIcon } from "lucide-react";

// Shared navigation source for both the mobile bottom nav and the desktop
// sidebar so the two never drift apart. `center` marks the hero tab (Lịch),
// rendered larger/raised on the mobile bottom nav.
export const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon; center?: boolean }[] = [
  { href: "/map", label: "Bản đồ", Icon: Map },
  { href: "/library", label: "Bộ sưu tập", Icon: Library },
  { href: "/calendar", label: "Lịch", Icon: CalendarHeart, center: true },
  { href: "/timeline", label: "Kỷ niệm", Icon: Images },
  { href: "/vault", label: "Bí mật", Icon: Lock },
];

// Routes with no app chrome (landing, auth, onboarding).
export const NAV_HIDDEN_ON = ["/", "/sign-in", "/sign-up", "/onboarding"];

// Where every successful login lands. Must be a SpaceGuard-protected feature
// route so the guard runs the "has a couple space? → stay in : → /onboarding"
// branch in one place — no auth flow re-implements that check. The unified
// calendar is the app's home surface.
export const POST_LOGIN_REDIRECT = "/calendar";
