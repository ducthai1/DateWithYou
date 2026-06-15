import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";
import { AppHeader } from "@/components/layout/app-header";
import { SpaceGuard } from "@/components/layout/space-guard";
import { MainWrapper } from "@/components/layout/main-wrapper";

const inter = Inter({
  variable: "--font-sans-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-serif-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vivu No Plan",
  description: "Nơi lưu kỷ niệm và lên kế hoạch hẹn hò của tụi mình.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body className={`${inter.variable} ${fraunces.variable} antialiased`}>
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
