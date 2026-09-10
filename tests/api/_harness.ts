/*
 * Runs the real tRPC routers, in-process, against a throwaway database.
 *
 * No HTTP and no browser: `createCallerFactory` gives a caller with the same
 * context shape the fetch adapter builds, so a test exercises the actual
 * procedure — its zod input, its middleware chain, its Mongoose writes — and
 * not a re-implementation of it. That matters most for `protectedProcedure`,
 * which is where space isolation is enforced; a test that stubbed it out
 * would prove nothing about the seam it is meant to guard.
 */
import "./_env";
import { TEST_DB } from "./_env";
import mongoose from "mongoose";
import { appRouter } from "@/server/trpc/root";
import { createCallerFactory } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";

const createCaller = createCallerFactory(appRouter);

export type TestCtx = {
  userId: string | null;
  userEmail: string | null;
  activeSpaceId: string | null;
};

/** A caller for one identity. Omitted fields behave like a signed-out request. */
export function callerFor(ctx: Partial<TestCtx> = {}) {
  return createCaller({
    userId: ctx.userId ?? null,
    userEmail: ctx.userEmail ?? null,
    activeSpaceId: ctx.activeSpaceId ?? null,
  });
}

/** A user id shaped like the ones Better Auth issues (Mongo ObjectId hex). */
export function newUserId(): string {
  return new mongoose.Types.ObjectId().toString();
}

/**
 * Connect, then empty the database.
 *
 * Dropping at the START of a file rather than the end is what makes a run
 * reproducible: a suite killed halfway through leaves rows behind, and the
 * next run would otherwise start on top of them.
 */
export async function freshDatabase(): Promise<void> {
  await connectToDatabase();
  const name = mongoose.connection.name;
  if (name !== TEST_DB) {
    throw new Error(`Connected to "${name}" instead of "${TEST_DB}". Refusing to drop it.`);
  }
  await mongoose.connection.dropDatabase();
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
  // connectToDatabase caches on globalThis; clear it so a later connect in the
  // same process reconnects instead of handing back a closed connection.
  (globalThis as { _mongooseCache?: unknown })._mongooseCache = { conn: null, promise: null };
}

/**
 * A Better Auth user row.
 *
 * The app reads names, avatars and gender straight out of the `user`
 * collection (see resolveMemberProfiles), so a test that skips this gets
 * "Người kia" everywhere and cannot tell two members apart.
 */
export async function makeUser(opts: {
  name: string;
  email?: string;
  gender?: string;
  image?: string;
}): Promise<{ id: string; email: string; name: string }> {
  const id = new mongoose.Types.ObjectId();
  const email = opts.email ?? `${opts.name.toLowerCase().replace(/\W+/g, "")}@example.test`;
  await mongoose.connection.collection("user").insertOne({
    _id: id,
    name: opts.name,
    email,
    emailVerified: true,
    image: opts.image ?? null,
    gender: opts.gender,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: id.toString(), email, name: opts.name };
}

/** A user plus a space they own, created through the real procedures. */
export async function makeMember(opts: {
  name: string;
  spaceName?: string;
  gender?: string;
}): Promise<{
  userId: string;
  email: string;
  spaceId: string;
  caller: ReturnType<typeof callerFor>;
}> {
  const user = await makeUser({ name: opts.name, gender: opts.gender });
  const bare = callerFor({ userId: user.id, userEmail: user.email });
  const { id: spaceId } = await bare.space.create({ name: opts.spaceName ?? `Góc của ${opts.name}` });
  return {
    userId: user.id,
    email: user.email,
    spaceId,
    caller: callerFor({ userId: user.id, userEmail: user.email, activeSpaceId: spaceId }),
  };
}

/**
 * Assert that a call is refused, and refused for the stated reason.
 *
 * Returning the error lets a test also check its message — several procedures
 * distinguish NO_SPACE from STALE_SPACE with the same code.
 */
export async function rejects(
  fn: () => Promise<unknown>,
  code: string,
): Promise<{ code: string; message: string }> {
  try {
    await fn();
  } catch (e) {
    const err = e as { code?: string; message?: string };
    const actual = err.code ?? "(no code)";
    if (actual !== code) {
      throw new Error(`Expected tRPC error ${code}, got ${actual}: ${err.message}`);
    }
    return { code: actual, message: err.message ?? "" };
  }
  throw new Error(`Expected tRPC error ${code}, but the call succeeded.`);
}

/**
 * Two people in one space, joined through the real invite code.
 *
 * Built the long way round rather than by writing `members: [a, b]` straight
 * into Mongo, because half of what the listen and invite tests are about is
 * what `partnerOf` and the membership guards do with a genuine second member.
 */
export async function makeCouple(opts?: { a?: string; b?: string; spaceName?: string }): Promise<{
  a: Awaited<ReturnType<typeof makeMember>>;
  b: { userId: string; email: string; caller: ReturnType<typeof callerFor> };
  spaceId: string;
}> {
  const a = await makeMember({ name: opts?.a ?? "An", spaceName: opts?.spaceName, gender: "female" });
  const other = await makeUser({ name: opts?.b ?? "Binh", gender: "male" });
  const { code } = await a.caller.space.createInvite();
  const joining = callerFor({ userId: other.id, userEmail: other.email });
  const joined = await joining.space.joinByCode({ code });
  if (joined.id !== a.spaceId) throw new Error("joinByCode landed in the wrong space");
  return {
    a,
    b: {
      userId: other.id,
      email: other.email,
      caller: callerFor({ userId: other.id, userEmail: other.email, activeSpaceId: a.spaceId }),
    },
    spaceId: a.spaceId,
  };
}

/** The row a test just wrote, insisted upon rather than checked twice. */
export function must<T>(value: T | undefined | null, what = "row"): T {
  if (value === undefined || value === null) throw new Error(`expected a ${what}, found none`);
  return value;
}
