// Hard-delete a couple space and every record scoped to it. Deleting only the
// space doc (the previous behaviour) left locations, memories, capsules, etc.
// orphaned — invisible but still in the DB. Every space-scoped collection is
// listed here explicitly, so adding a new feature collection is a deliberate
// edit to this list and can never be silently left behind on delete.
import { LocationModel } from "./models/location";
import { LocationConfigModel } from "./models/location-config";
import { LiveLocationModel } from "./models/live-location";
import { NavigationInviteModel } from "./models/navigation-invite";
import { MemoryModel } from "./models/memory";
import { MediaItemModel } from "./models/media-item";
import { SpecialDateModel } from "./models/special-date";
import { PlanItemModel } from "./models/plan-item";
import { WishlistItemModel } from "./models/wishlist-item";
import { RoadmapPlanModel } from "./models/roadmap-plan";
import { TimeCapsuleModel } from "./models/time-capsule";
import {
  RewardTaskModel,
  RewardLogModel,
  RewardVoucherModel,
  RewardAccountModel,
} from "./models/reward-models";
import { ReactionModel } from "./models/reaction";
import { NoteModel } from "./models/note";
import { MemberStateModel } from "./models/member-state";
import { SpaceModel } from "./models/space";

// Structural type — every Mongoose model exposes deleteMany(filter).
type Deletable = { deleteMany(filter: Record<string, unknown>): unknown };

const SPACE_SCOPED_MODELS: Deletable[] = [
  LocationModel,
  LocationConfigModel,
  LiveLocationModel,
  NavigationInviteModel,
  MemoryModel,
  MediaItemModel,
  SpecialDateModel,
  PlanItemModel,
  WishlistItemModel,
  RoadmapPlanModel,
  TimeCapsuleModel,
  RewardTaskModel,
  RewardLogModel,
  RewardVoucherModel,
  RewardAccountModel,
  ReactionModel,
  NoteModel,
  MemberStateModel,
];

/**
 * Remove every record scoped to `spaceId`, then the space itself. Data goes
 * first so a partial failure leaves the (still-present) space pointing at
 * being-cleaned data — a retryable state — rather than an orphaned dataset.
 * `allSettled` means one collection failing still lets the rest be cleaned in
 * the same pass; we only keep the space doc (the retry anchor) if every
 * collection succeeded. All space data is DB-resident (media items are
 * link-only — no app-hosted blobs), so removing these rows fully cleans it.
 */
export async function deleteSpaceAndData(spaceId: string): Promise<void> {
  const results = await Promise.allSettled(
    SPACE_SCOPED_MODELS.map((m) => m.deleteMany({ spaceId })),
  );
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0)
    throw new Error(`Space cascade incomplete: ${failed} collection(s) failed`);
  await SpaceModel.findByIdAndDelete(spaceId);
}
