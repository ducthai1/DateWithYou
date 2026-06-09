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
