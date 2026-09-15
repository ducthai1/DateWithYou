import { createHash } from "node:crypto";
import { ErrorLogModel } from "@/server/db/models/error-log";
import { connectToDatabase } from "@/server/db/connect";

/**
 * Record a server error where somebody will see it.
 *
 * Two rules, both load-bearing:
 *
 *   - **It can never throw.** This runs inside a catch, on a request that has
 *     already gone wrong. An error logger that fails the request it is
 *     reporting on turns one bad response into a worse one.
 *   - **It never stores what the user was doing.** Procedure inputs on this
 *     app carry notes between two people, place names and messages. Knowing a
 *     procedure failed is worth keeping; a copy of somebody's evening is not.
 */

/** Long enough to notice a pattern, short enough not to become an archive. */
const KEEP_DAYS = 14;
/** The first frames are where it went wrong; the rest is framework. */
const STACK_LINES = 8;

const fingerprintOf = (where: string, message: string) =>
  createHash("sha1").update(`${where}\n${message}`).digest("hex").slice(0, 16);

/** Anything at all, turned into one line. */
function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err).slice(0, 500);
  } catch {
    return String(err);
  }
}

export async function logServerError(
  where: string,
  err: unknown,
  who?: { spaceId?: string | null; userId?: string | null },
): Promise<void> {
  try {
    const message = messageOf(err).slice(0, 1000);
    const stack =
      err instanceof Error && err.stack
        ? err.stack.split("\n").slice(0, STACK_LINES).join("\n").slice(0, 4000)
        : undefined;
    const now = new Date();

    await connectToDatabase();
    await ErrorLogModel.updateOne(
      { fingerprint: fingerprintOf(where, message) },
      {
        $set: {
          where,
          message,
          stack,
          lastAt: now,
          spaceId: who?.spaceId ?? undefined,
          userId: who?.userId ?? undefined,
          expiresAt: new Date(now.getTime() + KEEP_DAYS * 86_400_000),
        },
        $setOnInsert: { firstAt: now, fingerprint: fingerprintOf(where, message) },
        $inc: { count: 1 },
      },
      { upsert: true },
    );
  } catch (loggingFailed) {
    // The last resort, and the only place a bare console.error is right: the
    // request this is reporting on has already failed, and failing it harder
    // helps nobody.
    console.error("logServerError could not record an error", loggingFailed);
  }
}
