import type { Metadata } from "next";
import { TikTokFeed } from "@/features/library/tiktok-feed";

/*
 * The TikTok screen. Full-bleed and its own overlay, so it renders outside
 * PageShell — a feed swiped with a thumb has no business inside a page column.
 */
export const metadata: Metadata = {
  title: "Lướt TikTok",
  robots: { index: false, follow: false },
};

export default async function TikTokFeedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TikTokFeed id={id} />;
}
