import { Map, Dices, Images, Lock, Settings, type LucideIcon } from "lucide-react";

// Shared navigation source for both the mobile bottom nav and the desktop
// sidebar so the two never drift apart.
export const NAV_ITEMS: { href: string; label: string; Icon: LucideIcon }[] = [
  { href: "/map", label: "Bản đồ", Icon: Map },
  { href: "/wheel", label: "Quay", Icon: Dices },
  { href: "/timeline", label: "Kỷ niệm", Icon: Images },
  { href: "/vault", label: "Bí mật", Icon: Lock },
  { href: "/settings", label: "Cài đặt", Icon: Settings },
];

// Routes with no app chrome (landing, auth, onboarding).
export const NAV_HIDDEN_ON = ["/", "/sign-in", "/sign-up", "/onboarding"];

// Where every successful login lands. Must be a SpaceGuard-protected feature
// route so the guard runs the "has a couple space? → stay in : → /onboarding"
// branch in one place — no auth flow re-implements that check.
export const POST_LOGIN_REDIRECT = "/map";
