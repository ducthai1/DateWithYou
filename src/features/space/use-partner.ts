"use client";

import { trpc } from "@/lib/trpc";

export type Partner = {
  id: string;
  name: string;
  image?: string | null;
  avatarEmoji?: string | null;
  avatarColor?: string | null;
};

/**
 * The other person in the space.
 *
 * A space holds two people who invited each other, so calling them "Người kia"
 * on screen is stranger than using the name they signed up with — you cannot
 * be in here with someone you do not know.
 *
 * Reads `isSelf`, which the server already resolves, rather than comparing
 * against the session on the client: the session arrives on its own schedule,
 * and for the moment it has not, every member looks like the partner.
 *
 * Null while loading and in a space of one — callers fall back to the generic
 * word for those, which is the only time it is the honest thing to say.
 */
export function usePartner(): Partner | null {
  const members = trpc.space.members.useQuery();
  const other = members.data?.find((m) => !m.isSelf);
  return other ?? null;
}

/** Their name, or the generic word while we genuinely do not have one. */
export function usePartnerName(fallback = "Người kia"): string {
  return usePartner()?.name?.trim() || fallback;
}
