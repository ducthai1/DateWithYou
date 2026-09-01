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
import { AppBackdrop } from "@/components/theme/app-backdrop";
import { AppleSplashLinks } from "@/components/layout/apple-splash-links";
import { RegisterMapCache } from "@/components/layout/register-map-cache";
import { WarmMapAssets } from "@/components/layout/warm-map-assets";
import { PrimeHaptics } from "@/components/layout/prime-haptics";
import { PushSetup } from "@/components/layout/push-setup";
import { GlobalInviteListener } from "@/components/layout/global-invite-listener";
import { WelcomeIntro } from "@/components/layout/welcome-intro";
import { NavigationInvitesProvider } from "@/features/locations/navigation-invites-context";
import { NavigationProvider } from "@/features/locations/navigation-context";
import { NavigationMiniDock } from "@/features/locations/navigation-mini-dock";
import { THEME_COOKIE_NAME, resolveThemeKey } from "@/lib/theme-presets";
import { TONE_COOKIE_NAME, TONE_FALLBACK, isTone, resolvePreference } from "@/lib/tone";
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
  /*
   * Kept broad and honest, but do not expect much of it: Google stopped using
   * the keywords meta tag in 2009 and the other major engines followed. What
   * actually earns a query is the visible text — which is why the widening of
   * this product's audience went into the headings, the feature copy and the
   * FAQ rather than into this list. Brand spellings are declared where a search
   * engine really does read them: `alternateName` on the Organization node.
   */
  keywords: [
    "Vivu No Plan",
    "VivuNoPlan",
    "vi vu không cần plan",
    "đi chơi không cần plan",
    "app lưu kỷ niệm",
    "app lên kế hoạch đi chơi",
    "nhật ký chuyến đi",
    "lưu địa điểm đã đi",
    "vòng quay chọn quán ăn",
    "hộp thời gian",
    "lịch chung",
    "app cho hai người",
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
    images: [{ url: "/og-card.jpg", width: 1200, height: 630, alt: SITE_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [{ url: "/og-card.jpg", alt: SITE_TITLE }],
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
  /*
   * /favicon.ico is listed first and shipped as a real multi-size ICO. Browsers
   * and Google's favicon fetcher both still probe that exact path, and it was
   * answering 404 — the rel=icon PNG alone is not a reliable substitute.
   *
   * The file lives in public/ rather than app/. Both serve the same URL, but an
   * app/favicon.ico is a metadata route that Next parses at build time, while a
   * public/ file is copied verbatim — one less thing that can fail in a build.
   */
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
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

  /*
   * Artwork tone, as far as the server can know it.
   *
   * An explicit choice is in the cookie, so it renders correctly first time.
   * "auto" depends on the reader's own clock — their timezone is not the
   * server's — so it renders the fallback and ToneProvider corrects it on
   * mount. A blocking script cannot help here: React owns data-tone on <html>
   * and puts its own value back during hydration.
   */
  const tonePref = resolvePreference(cookieStore.get(TONE_COOKIE_NAME)?.value);
  const initialTone = isTone(tonePref) ? tonePref : TONE_FALLBACK;

  return (
    <html lang="vi" data-theme={themeKey} data-tone={initialTone}>
      {/* Scroll reveals hide their content until an observer flips them on.
          With JavaScript off nothing would ever flip, so the whole landing page
          below the hero would render as a blank column. */}
      <noscript>
        <style>{`[data-reveal]{opacity:1 !important;animation:none !important}`}</style>
      </noscript>
      <head>
        {/*
          Open the connection to the tile server before anything asks for it.
          The map needs a style, a sprite, six font ranges and then tiles from
          this host, and on a phone the first of those pays DNS, TCP and TLS
          before a byte arrives — three round trips on a link where a round trip
          is 150ms. Doing it here, on every page, means the handshake is already
          done by the time someone opens the map. `crossOrigin` matters: the
          font and sprite fetches are CORS requests, and a connection opened
          without it is not reused for them.
        */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <AppleSplashLinks />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${lora.variable} antialiased`}>
        <RegisterMapCache />
        <WarmMapAssets />
        <PrimeHaptics />
        <PushSetup />
        {/* SpaceGuard is mounted inside <Providers> — it is client-only
            (ssr: false), which a Server Component cannot declare. */}
        <Providers initialTone={initialTone}>
          <AppBackdrop />
          <SideNav />
          {/* Offset for the bottom nav on mobile, for the sidebar on desktop. */}
          <MainWrapper>
            <AppHeader />
            {/* Single SSE connection for the whole app — both GlobalInviteListener
                and LocationsPage consume this context instead of opening their own. */}
            <NavigationInvitesProvider>
              {/* Live navigation is owned here, not by the map page. Mounted
                  inside the map page it was torn down by any route change,
                  which stopped the GPS watch and released the wake lock on
                  someone mid-journey. */}
              <NavigationProvider>
                <GlobalInviteListener />
                <WelcomeIntro />
                {children}
                <NavigationMiniDock />
              </NavigationProvider>
            </NavigationInvitesProvider>
          </MainWrapper>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
