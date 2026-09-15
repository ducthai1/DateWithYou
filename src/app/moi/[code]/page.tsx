import type { Metadata } from "next";
import { JoinByInviteClient } from "@/features/space/join-by-invite-client";

export const metadata: Metadata = {
  title: "Lời mời vào không gian",
  // Every invite link is unique and private to two people; there is nothing
  // here for a search engine, and indexing one would publish a live code.
  robots: { index: false, follow: false },
};

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <JoinByInviteClient code={code} />;
}
