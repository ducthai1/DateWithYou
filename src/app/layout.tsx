import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Lora } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import "react-photo-view/dist/react-photo-view.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";
import { AppHeader } from "@/components/layout/app-header";
import { MainWrapper } from "@/components/layout/main-wrapper";
import { GlobalInviteListener } from "@/components/layout/global-invite-listener";
import { WelcomeIntro } from "@/components/layout/welcome-intro";
import { NavigationInvitesProvider } from "@/features/locations/navigation-invites-context";
import { THEME_COOKIE_NAME, resolveThemeKey } from "@/lib/theme-presets";
import { SITE_DESCRIPTION, SITE_LOCALE, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";

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
  /*
   * metadataBase is what turns every relative URL below (canonical, og:image,
   * the generated opengraph-image) into an absolute one. Without it Next emits
   * them as paths, and crawlers plus link unfurlers discard them.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    // Feature screens set only their own name; the brand is appended here so
    // it never has to be repeated (and never drifts) per page.
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "ứng dụng cho cặp đôi",
    "app cho couple",
    "lịch hẹn hò",
    "lưu kỷ niệm tình yêu",
    "hộp thời gian",
    "vòng quay ăn gì",
    "kế hoạch hẹn hò",
    "Vivu No Plan",
  ],
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "lifestyle",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: SITE_LOCALE,
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  /*
   * Explicit crawl directives. `max-image-preview: large` is what allows a
   * full-width image in the mobile result; the default is a thumbnail.
   */
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  /*
   * Search Console ownership proof. Set NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION in
   * the Vercel project to the token from the "HTML tag" verification method —
   * the value inside content="...", not the whole tag. Left unset, Next simply
   * omits the meta tag, so this costs nothing until it is needed.
   */
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  manifest: "/manifest.webmanifest",
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
        {/* SpaceGuard is mounted inside <Providers> — it is client-only
            (ssr: false), which a Server Component cannot declare. */}
        <Providers>
          <SideNav />
          {/* Offset for the bottom nav on mobile, for the sidebar on desktop. */}
          <MainWrapper>
            <AppHeader />
            {/* Single SSE connection for the whole app — both GlobalInviteListener
                and LocationsPage consume this context instead of opening their own. */}
            <NavigationInvitesProvider>
              <GlobalInviteListener />
              <WelcomeIntro />
              {children}
            </NavigationInvitesProvider>
          </MainWrapper>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
