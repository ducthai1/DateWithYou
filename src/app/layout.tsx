import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";
import { AppHeader } from "@/components/layout/app-header";
import { SpaceGuard } from "@/components/layout/space-guard";
import { MainWrapper } from "@/components/layout/main-wrapper";
import { THEME_COOKIE_NAME, resolveThemeKey } from "@/lib/theme-presets";

const inter = Inter({
  variable: "--font-sans-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vivu No Plan",
  description: "Nơi lưu kỷ niệm và lên kế hoạch hẹn hò của tụi mình.",
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
      <body className={`${inter.variable} antialiased`}>
        <Providers>
          <SpaceGuard />
          <SideNav />
          {/* Offset for the bottom nav on mobile, for the sidebar on desktop. */}
          <MainWrapper>
            <AppHeader />
            {children}
          </MainWrapper>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
