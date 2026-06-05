import type { Metadata } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { BottomNav } from "@/components/layout/bottom-nav";

const inter = Inter({
  variable: "--font-sans-inter",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-serif-fraunces",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chuyện của Cá",
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
          <div className="pb-16">{children}</div>
          <BottomNav />
        </Providers>
      </body>
    </html>
  );
}
