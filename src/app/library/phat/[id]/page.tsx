import type { Metadata } from "next";
import { WatchScreen } from "@/features/library/watch-screen";

/*
 * The watch page: one item of the library, large, with its playlist beside
 * it — the way a video opens on YouTube. The frame itself is not rendered
 * here: the floating player above the router lays itself over a box this
 * page registers, so walking away mid-song simply lets it float again.
 *
 * No PageShell: this screen owns its own frame, because on a phone the video
 * has to sit outside everything that scrolls (see WatchScreen).
 */
export const metadata: Metadata = {
  title: "Đang phát",
  robots: { index: false, follow: false },
};

export default async function WatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <WatchScreen id={id} />;
}
