import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Lora } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "react-photo-view/dist/react-photo-view.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";
import { AppHeader } from "@/components/layout/app-header";
import { SpaceGuard } from "@/components/layout/space-guard";
import { MainWrapper } from "@/components/layout/main-wrapper";
import { GlobalInviteListener } from "@/components/layout/global-invite-listener";
import { NavigationInvitesProvider } from "@/features/locations/navigation-invites-context";
import { THEME_COOKIE_NAME, resolveThemeKey } from "@/lib/theme-presets";

const inter = Inter({
  variable: "--font-sans-inter",
  subsets: ["latin"],
});

// Romantic serif pair used by the Time Capsule letter (display title + body).
// Vietnamese subset so accented glyphs render correctly. Loaded globally as CSS
// vars but applied only where opted in — the app-wide `font-serif` stays Inter.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
});
const lora = Lora({
  variable: "--font-letter",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Vivu No Plan",
  description: "Nơi lưu kỷ niệm và lên kế hoạch hẹn hò của tụi mình.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Vivu" },
  formatDetection: { telephone: false },
};

/*
 * Mobile-first viewport. `viewportFit: "cover"` is what makes the CSS
 * env(safe-area-inset-*) values resolve to real notch / home-indicator insets —
 * without it every safe-area pad in the app silently collapses to 0. We keep
 * pinch-zoom enabled (no maximumScale) for accessibility, and themeColor follows
 * the parchment background so the iOS status bar / Android chrome blends in.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f1ece3",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
   * Read the theme preset from the cookie set on login / Settings switch.
   * Resolving server-side means the correct [data-theme] attribute is already
   * in the HTML before any JS runs, so there is no flash of wrong theme (FOUC).
   * resolveThemeKey() validates the raw value and falls back to "terracotta"
   * when the cookie is absent, expired, or contains an unrecognised key.
   */
  const cookieStore = await cookies();
  const rawTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const themeKey = resolveThemeKey(rawTheme);

  return (
    <html lang="vi" data-theme={themeKey}>
      <body className={`${inter.variable} ${playfair.variable} ${lora.variable} antialiased`}>
        <Providers>
          <SpaceGuard />
          <SideNav />
          {/* Offset for the bottom nav on mobile, for the sidebar on desktop. */}
          <MainWrapper>
            <AppHeader />
            {/* Single SSE connection for the whole app — both GlobalInviteListener
                and LocationsPage consume this context instead of opening their own. */}
            <NavigationInvitesProvider>
              <GlobalInviteListener />
              {children}
            </NavigationInvitesProvider>
          </MainWrapper>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
