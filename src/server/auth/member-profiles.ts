import "server-only";
import mongoose, { Types } from "mongoose";
import { connectToDatabase } from "@/server/db/connect";

export type MemberProfile = {
  id: string;
  name: string;
  image: string | null;
};

/**
 * Resolve display name + avatar for member user ids. Better Auth stores users in
 * the shared `user` collection (same Atlas DB as the app), keyed by `_id`. We
 * read it directly via the Mongoose connection rather than the auth client so it
 * works inside tRPC procedures that already hold a Mongoose connection.
 */
export async function resolveMemberProfiles(
  userIds: string[],
): Promise<MemberProfile[]> {
  if (userIds.length === 0) return [];
  await connectToDatabase();
  const objectIds = userIds
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));
  const docs = await mongoose.connection
    .collection("user")
    .find({ _id: { $in: objectIds } })
    .project({ name: 1, image: 1, email: 1 })
    .toArray();
  const byId = new Map(docs.map((d) => [String(d._id), d]));
  return userIds.map((id) => {
    const d = byId.get(id);
    return {
      id,
      name: (d?.name as string) || (d?.email as string)?.split("@")[0] || "Người kia",
      image: (d?.image as string) ?? null,
    };
  });
}
