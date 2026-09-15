/*
 * The eight procedures in `location` that talk to somebody else's server.
 *
 * Every other router in this app answers out of Mongo, so a test that runs is
 * a test that proves something. These eight do not: suggestPlaces, placeCoords
 * and placeDetail ask TrackAsia; areaAt asks TrackAsia then OpenStreetMap;
 * geoFromUrl follows Google's own redirects; getRoute and rankMeetingPoints
 * ask Stadia. Which is exactly why they had no tests at all — and why the
 * interesting behaviour is not the happy path (somebody else's uptime) but the
 * one this machine and every CI box is actually in: NO KEYS CONFIGURED.
 *
 * `tests/api/_env.ts` clears GOOGLE_MAPS_API_KEY and STADIA_API_KEY so the
 * suite cannot spend real money. That state is not hypothetical — a fresh
 * clone, a preview deploy, a contributor without the secrets, and a provider
 * whose key has lapsed all land in it. What must hold there is that the map
 * still opens, the form still saves, and the couple sees "no suggestions"
 * rather than a red screen. So each procedure below is asked the same three
 * questions:
 *
 *   1. With no key, does it degrade or does it throw?
 *   2. Does malformed input come back as a clean refusal, or as a 500 with a
 *      Mongoose CastError inside it?
 *   3. Can a signed-out caller, or a caller from another space, reach it?
 *
 * Two answers below are NOT what the rest of the file establishes as the
 * house style, and are pinned here as the behaviour that exists rather than
 * the behaviour that was wanted — see the comments on getRoute.
 *
 * ---------------------------------------------------------------------------
 * NO NETWORK. NOT EVEN ONCE.
 *
 * Deleting keys is not enough on its own, and finding that out is half of why
 * this file is careful. Two of these paths need no key at all:
 *   - areaAt falls through to Nominatim, which is keyless and rate-limited by
 *     IP — a test suite hammering it on every push is a ban waiting to happen.
 *   - geoFromUrl fetches maps.app.goo.gl to follow a short link.
 * Both would quietly reach the internet from a suite that is supposed to be
 * hermetic, and both would turn a CI box with no egress into a flaky failure.
 *
 * So `fetch` itself is replaced, for this file only, with one that records the
 * attempt and fails the way an offline machine fails. That makes "no network"
 * a fact the suite enforces rather than a habit it relies on, it makes each
 * test able to ASSERT how many requests a procedure spent, and it means the
 * run behaves identically with the cable pulled out.
 */
import test, { after, before, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import {
  freshDatabase,
  closeDatabase,
  makeMember,
  makeCouple,
  callerFor,
  rejects,
  must,
} from "./_harness.ts";

/* -------------------------------------------------------------------------
 * The network ledger
 * ---------------------------------------------------------------------- */

/** Requests attempted since the current test started. Cleared per test. */
const REQUESTS: string[] = [];
/** Every host reached for across the whole file, for the closing audit. */
const HOSTS_EVER = new Set<string>();

/*
 * Installed at module load, which runs before node:test executes the first
 * test, so nothing in this file can outrun it.
 *
 * It throws the shape undici throws when a machine has no route to the host,
 * because the point is to be indistinguishable from offline: any code that
 * only degrades gracefully for a *tidy* failure would pass here and still
 * break on a train.
 */
globalThis.fetch = (async (input: unknown) => {
  const url =
    typeof input === "string"
      ? input
      : String((input as { url?: string })?.url ?? input);
  REQUESTS.push(url);
  try {
    HOSTS_EVER.add(new URL(url).hostname);
  } catch {
    HOSTS_EVER.add(url);
  }
  throw new TypeError("fetch failed", { cause: new Error("network blocked by tests/api/location-network.test.ts") });
}) as typeof globalThis.fetch;

/** What this procedure just tried to reach, if anything. */
function requestsMade(): string[] {
  return [...REQUESTS];
}

/**
 * Input the TypeScript types forbid but an HTTP client can send anyway.
 *
 * The browser is not the only caller of a tRPC endpoint — anyone with the
 * session cookie can POST whatever they like — so the zod schema, not the
 * compiler, is what actually stands between a bad coordinate and Mongoose.
 * These tests have to be able to send the bad coordinate.
 */
const asClientSent = <T>(value: unknown): T => value as T;

/* -------------------------------------------------------------------------
 * Fixtures
 * ---------------------------------------------------------------------- */

let me: Awaited<ReturnType<typeof makeMember>>;
let outsider: Awaited<ReturnType<typeof makeMember>>;
const anon = callerFor({});

const SAIGON = { lat: 10.7769, lng: 106.7009 };
const THU_DUC = { lat: 10.8505, lng: 106.7717 };

before(async () => {
  await freshDatabase();
  me = await makeMember({ name: "Linh", spaceName: "Góc của Linh" });
  outsider = await makeMember({ name: "Ngoai", spaceName: "Góc của người lạ" });
  assert.notEqual(me.spaceId, outsider.spaceId, "the two fixtures must be different spaces");
  assert.equal(process.env.STADIA_API_KEY, undefined, "_env clears the routing key");
  assert.equal(process.env.GOOGLE_MAPS_API_KEY, undefined, "_env clears the Google key");
  assert.equal(
    process.env.TRACKASIA_API_KEY,
    undefined,
    "the places/geocoding key must be absent too — _env does not clear this one, so a machine that has it would send this suite to a live provider",
  );
});

after(closeDatabase);

beforeEach(() => {
  REQUESTS.length = 0;
});

/**
 * A saved place, written straight into Mongo.
 *
 * `location.create` reverse-geocodes anything with a `geo` on it, so building
 * a fixture through the router would be the one network call this file exists
 * to forbid.
 */
async function seedPlace(
  spaceId: string,
  over: Record<string, unknown> = {},
): Promise<string> {
  const res = await mongoose.connection.collection("locations").insertOne({
    spaceId,
    name: "Quán cà phê",
    district: "Phường Sài Gòn",
    category: "Cà phê",
    geo: { ...SAIGON },
    status: "want_to_go",
    source: "user",
    createdBy: "seed",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });
  return String(res.insertedId);
}

/* -------------------------------------------------------------------------
 * Reachability
 * ---------------------------------------------------------------------- */

describe("a signed-out caller reaches none of the eight", () => {
  /*
   * These are the procedures that cost money or rate limit, so an unguarded
   * one is not merely a privacy hole — it is an open relay onto somebody's
   * paid API, reachable with no account at all. `protectedProcedure` is what
   * stops that, and this table is the proof that every one of the eight is
   * actually behind it rather than merely next to ones that are.
   */
  const CALLS: Array<[string, () => Promise<unknown>]> = [
    ["suggestPlaces", () => anon.location.suggestPlaces({ query: "cà phê" })],
    ["placeCoords", () => anon.location.placeCoords({ placeIds: ["ChIJabc"] })],
    ["placeDetail", () => anon.location.placeDetail({ placeId: "ChIJabc" })],
    ["searchAreas", () => anon.location.searchAreas({ query: "sài gòn" })],
    ["areaAt", () => anon.location.areaAt(SAIGON)],
    ["geoFromUrl", () => anon.location.geoFromUrl({ url: "https://maps.app.goo.gl/abc" })],
    ["getRoute", () => anon.location.getRoute({ origin: SAIGON, destination: THU_DUC })],
    [
      "rankMeetingPoints",
      () =>
        anon.location.rankMeetingPoints({
          origins: [SAIGON, THU_DUC],
          candidates: [{ id: "c1", geo: SAIGON }],
        }),
    ],
  ];

  for (const [name, call] of CALLS) {
    test(name, async () => {
      await rejects(call, "UNAUTHORIZED");
      assert.deepEqual(
        requestsMade(),
        [],
        `${name}: a signed-out request reached a provider before the auth check`,
      );
    });
  }
});

/* -------------------------------------------------------------------------
 * suggestPlaces
 * ---------------------------------------------------------------------- */

describe("suggestPlaces — the autocomplete under the search box", () => {
  test("with no key it answers an empty list, and spends nothing finding that out", async () => {
    /*
     * The search box stays on screen whatever this returns, so the only two
     * acceptable answers are "here are some places" and "none". Throwing
     * would take the whole map screen down with it on a deploy whose key was
     * never set.
     */
    const out = await me.caller.location.suggestPlaces({ query: "cà phê", near: SAIGON });
    assert.deepEqual(out, []);
    assert.deepEqual(
      requestsMade(),
      [],
      "an unkeyed provider must be skipped, not called and then rejected — a call would cost a round trip on every keystroke",
    );
  });

  test("a query too short to be a search is answered without asking anyone", async () => {
    /*
     * One character matches tens of thousands of places, so the answer would
     * be worthless and the request is not free — the handler drops it before
     * the provider. With no key that short-circuit cannot be told apart from
     * the keyless one above; what this pins is that neither shape (a single
     * letter, whitespace, a cleared box) turns into an error the search box
     * has to render.
     */
    for (const query of ["c", "   ", ""]) {
      assert.deepEqual(await me.caller.location.suggestPlaces({ query }), []);
    }
    assert.deepEqual(requestsMade(), []);
  });

  test("an over-long query is refused by the schema, not forwarded", async () => {
    // 120 is the cap. Without it the query string goes straight into a
    // provider URL, so the ceiling is the only thing bounding what this app
    // will send on a stranger's behalf.
    await me.caller.location.suggestPlaces({ query: "x".repeat(120) });
    const err = await rejects(
      () => me.caller.location.suggestPlaces({ query: "x".repeat(121) }),
      "BAD_REQUEST",
    );
    assert.ok(err.message.includes("too_big"), "and it says which rule it broke");
    assert.deepEqual(requestsMade(), []);
  });

  test("a bias that is not a coordinate is refused, never coerced", async () => {
    /*
     * `near` is interpolated into the provider URL as `location=lat,lng`. A
     * string that slipped through would be sent verbatim; refusing is what
     * keeps this endpoint from being a way to append arbitrary text to an
     * outbound request.
     */
    await rejects(
      () =>
        me.caller.location.suggestPlaces({
          query: "cà phê",
          near: asClientSent({ lat: "10.7", lng: 106.7 }),
        }),
      "BAD_REQUEST",
    );
  });

  test("no bias at all is allowed — the client has none until the map reports in", async () => {
    // The first keystroke happens before the map has published its centre, so
    // `null` here is the normal first call, not an error case. The handler
    // substitutes a fallback bias of its own.
    assert.deepEqual(await me.caller.location.suggestPlaces({ query: "cà phê", near: null }), []);
    assert.deepEqual(await me.caller.location.suggestPlaces({ query: "cà phê" }), []);
  });
});

/* -------------------------------------------------------------------------
 * placeCoords
 * ---------------------------------------------------------------------- */

describe("placeCoords — the distance beside each suggestion row", () => {
  test("with no key the rows simply carry no distance", async () => {
    /*
     * This is decoration on a list that is already usable: each row shows its
     * address regardless. An empty map means "no distances", which the client
     * renders as nothing at all — the failure mode has to be silent here, not
     * loud.
     */
    assert.deepEqual(await me.caller.location.placeCoords({ placeIds: ["ChIJa", "ChIJb"] }), {});
    assert.deepEqual(requestsMade(), []);
  });

  test("an empty batch is a no-op rather than an error", async () => {
    // The client calls this with whatever the suggestion list holds, which is
    // empty on the first render and after a cleared box.
    assert.deepEqual(await me.caller.location.placeCoords({ placeIds: [] }), {});
  });

  test("the batch cap is enforced, because each id is a separate paid call", async () => {
    // Ten ids are ten details requests fired in parallel. The cap is the only
    // thing between one tRPC call and an unbounded fan-out.
    await me.caller.location.placeCoords({
      placeIds: Array.from({ length: 10 }, (_, i) => `ChIJ${i}`),
    });
    const err = await rejects(
      () =>
        me.caller.location.placeCoords({
          placeIds: Array.from({ length: 11 }, (_, i) => `ChIJ${i}`),
        }),
      "BAD_REQUEST",
    );
    assert.ok(err.message.includes("too_big"));
  });

  test("a blank id in the batch is refused rather than sent as an empty lookup", async () => {
    await rejects(() => me.caller.location.placeCoords({ placeIds: [""] }), "BAD_REQUEST");
    assert.deepEqual(requestsMade(), []);
  });
});

/* -------------------------------------------------------------------------
 * placeDetail
 * ---------------------------------------------------------------------- */

describe("placeDetail — the coordinate behind the row somebody tapped", () => {
  test("with no key it answers null, and the form stays usable", async () => {
    /*
     * This runs when a person picks a suggestion, and its answer pre-fills
     * name, address and pin. Null means the fields stay blank and they type
     * it themselves — annoying, and far better than a save screen that
     * refuses to open.
     */
    assert.equal(await me.caller.location.placeDetail({ placeId: "ChIJabcdef" }), null);
    assert.deepEqual(requestsMade(), []);
  });

  test("a blank or over-long place id is refused before anything is fetched", async () => {
    // Same reasoning as the query cap: this value is interpolated into an
    // outbound URL, so its length is this app's problem, not the provider's.
    await rejects(() => me.caller.location.placeDetail({ placeId: "" }), "BAD_REQUEST");
    await rejects(
      () => me.caller.location.placeDetail({ placeId: "x".repeat(201) }),
      "BAD_REQUEST",
    );
    assert.deepEqual(requestsMade(), []);
  });
});

/* -------------------------------------------------------------------------
 * searchAreas
 * ---------------------------------------------------------------------- */

describe("searchAreas — the ward picker", () => {
  test("it answers from the bundled dataset, with no key and no request", async () => {
    /*
     * The odd one out of the eight, and deliberately so: the ward list is
     * ~600KB of JSON shipped with the app, searched in process. That is why
     * the area field keeps working on a deploy with no provider keys at all,
     * and it is worth pinning — moving this to a geocoder later would make
     * the single most-used field in the save form depend on somebody else's
     * uptime.
     */
    const out = await me.caller.location.searchAreas({ query: "sai gon" });
    const first = must(out[0], "area option");
    assert.ok(
      first.value.includes("Sài Gòn"),
      "and it folds accents, so a keyboard without diacritics still finds the ward",
    );
    assert.deepEqual(requestsMade(), []);
  });

  test("an empty query offers somewhere to start rather than nothing", async () => {
    // Opening the field with no idea what to type is the common case; an empty
    // list there reads as "this app doesn't know my area".
    const out = await me.caller.location.searchAreas({ query: "" });
    assert.ok(out.length > 0, "an empty query must not return an empty list");
    assert.ok(out.length <= 25, "and it must stay capped — the full list is 3,320 rows");
  });

  test("a query matching nothing is an empty list, not an error", async () => {
    assert.deepEqual(await me.caller.location.searchAreas({ query: "zzzqqqxxx" }), []);
  });

  test("an over-long query is refused", async () => {
    await me.caller.location.searchAreas({ query: "x".repeat(80) });
    await rejects(
      () => me.caller.location.searchAreas({ query: "x".repeat(81) }),
      "BAD_REQUEST",
    );
  });
});

/* -------------------------------------------------------------------------
 * areaAt
 * ---------------------------------------------------------------------- */

describe("areaAt — which ward a dropped pin fell in", () => {
  test("with no key it answers null instead of failing the pin", async () => {
    /*
     * This fills in a field the person can type themselves, and the save does
     * not wait for it. Null is the designed answer for every failure — no
     * key, a timeout, a provider that has never heard of the place — because
     * the alternative is a map you cannot drop a pin on.
     */
    assert.equal(await me.caller.location.areaAt(SAIGON), null);
  });

  test("it still reaches for a keyless provider, which is why this suite blocks fetch", async () => {
    /*
     * The documented reason this file replaces `fetch` rather than trusting
     * the cleared keys. TrackAsia is skipped without a key, but Nominatim
     * needs none, so an unguarded run of this one procedure would hit
     * OpenStreetMap from CI on every push — against their usage policy, from
     * a shared IP, for a value nothing asserts on.
     *
     * If this assertion ever starts failing because no request was made, that
     * is good news and the guard can relax. Until then it is load-bearing.
     */
    await me.caller.location.areaAt(SAIGON);
    const sent = requestsMade();
    assert.equal(sent.length, 1, "exactly one keyless fallback, not a retry storm");
    assert.match(sent[0], /nominatim\.openstreetmap\.org/);
  });

  test("a provider that cannot be reached at all is still just null", async () => {
    // Offline, in other words. The pin has to drop on a train too.
    assert.equal(await me.caller.location.areaAt(THU_DUC), null);
  });

  test("NaN and Infinity are refused, not sent onward", async () => {
    // `Number("abc")` on the client is how a NaN gets here. Zod rejects both
    // non-finite forms, which is what stops `?latlng=NaN,NaN` going out.
    await rejects(() => me.caller.location.areaAt(asClientSent({ lat: NaN, lng: 0 })), "BAD_REQUEST");
    await rejects(
      () => me.caller.location.areaAt(asClientSent({ lat: Infinity, lng: 0 })),
      "BAD_REQUEST",
    );
    await rejects(() => me.caller.location.areaAt(asClientSent({ lat: 10.7 })), "BAD_REQUEST");
    await rejects(
      () => me.caller.location.areaAt(asClientSent({ lat: "10.7", lng: 106.7 })),
      "BAD_REQUEST",
    );
    assert.deepEqual(requestsMade(), [], "none of those may reach a provider");
  });

  test("a coordinate off the planet is refused, and costs nothing", async () => {
    /*
     * This was pinned the other way round: `geo` had no range, so lat 999
     * passed validation and bought a real lookup for a point that cannot
     * exist — a free way to make this server issue billed requests. Two
     * `.min()/.max()` calls closed it.
     */
    await rejects(() => me.caller.location.areaAt({ lat: 999, lng: 999 }), "BAD_REQUEST");
    await rejects(() => me.caller.location.areaAt({ lat: 0, lng: -181 }), "BAD_REQUEST");
    assert.deepEqual(requestsMade(), [], "and nothing reaches a provider");
  });
});

/* -------------------------------------------------------------------------
 * geoFromUrl
 * ---------------------------------------------------------------------- */

describe("geoFromUrl — pasting a Maps link into the save form", () => {
  test("a link carrying its own marker resolves with no network at all", async () => {
    /*
     * The desktop "Copy link" shape. The coordinates are in the string, so
     * the fast path must not go near a provider — this is the one branch that
     * still works with no keys, no egress and no Google.
     */
    const out = await me.caller.location.geoFromUrl({
      url: "https://www.google.com/maps/place/Quán/@10.7,106.6,17z/data=!3m1!4b1!3d10.776889!4d106.700806",
    });
    assert.deepEqual(out, { lat: 10.776889, lng: 106.700806 });
    assert.deepEqual(requestsMade(), []);
  });

  test("a link wrapped in pasted prose still resolves", async () => {
    // Phone clipboards paste "Quán X https://… nhé". Extracting the URL is
    // the difference between the nicest way to add a place and a refusal.
    const out = await me.caller.location.geoFromUrl({
      url: "Quán ngon https://www.google.com/maps/place/Q/data=!3d10.5!4d106.5 nhé",
    });
    assert.deepEqual(out, { lat: 10.5, lng: 106.5 });
    assert.deepEqual(requestsMade(), []);
  });

  test("a host the resolver refuses to fetch is answered from the link text alone", async () => {
    /*
     * The SSRF gate. `geoFromUrl` takes an arbitrary string from an
     * authenticated user and fetches it, so the allowlist is the whole
     * defence: without it this endpoint is a way to make the server GET
     * localhost, a metadata endpoint, or anything on the private network.
     *
     * Asserting zero requests is what proves the gate ran BEFORE the fetch
     * rather than relying on the request failing for other reasons.
     */
    for (const url of [
      "https://localhost/maps/place/X",
      "https://127.0.0.1/maps/place/X",
      "https://example.com/maps/place/X",
      "https://goo.gl/not-a-map",
    ]) {
      assert.equal(await me.caller.location.geoFromUrl({ url }), null, url);
    }
    assert.deepEqual(requestsMade(), [], "a blocked host must never be requested");
  });

  test("a blocked host that carries a camera centre still gives the pin somewhere to land", async () => {
    // Refusing to fetch is not refusing to read: coordinates already in the
    // string are free, and near-enough beats nothing on a form that invites a
    // correcting tap.
    const out = await me.caller.location.geoFromUrl({ url: "https://example.com/x/@10.5,106.5,17z" });
    assert.deepEqual(out, { lat: 10.5, lng: 106.5 });
    assert.deepEqual(requestsMade(), []);
  });

  test("a short link is the one shape that must go out — and it survives being offline", async () => {
    /*
     * The phone Share shape. It carries no coordinates, so the only way to
     * learn anything is to follow the redirect, and this is the second reason
     * `fetch` is replaced in this file rather than the keys merely cleared.
     *
     * The behaviour worth pinning is what happens when that fetch cannot
     * happen: null, promptly, with no throw. Somebody pasting a link on a
     * flaky connection gets an empty pin and a form they can still fill in.
     */
    const out = await me.caller.location.geoFromUrl({ url: "https://maps.app.goo.gl/abcdef" });
    assert.equal(out, null);
    const sent = requestsMade();
    assert.ok(sent.length > 0, "a short link has to be followed; nothing else is in it");
    assert.ok(
      sent.every((u) => u.startsWith("https://maps.app.goo.gl/")),
      `only the pasted short link may be requested, got ${JSON.stringify(sent)}`,
    );
    assert.ok(sent.length <= 2, "one retry at most — a stall must not multiply");
  });

  test("text with no link in it is null rather than an error", async () => {
    // People paste the place's name into that box. It is a mistake, not a
    // fault, and the form says so itself.
    assert.equal(await me.caller.location.geoFromUrl({ url: "khong phai link" }), null);
    assert.deepEqual(requestsMade(), []);
  });

  test("an empty or oversized url is refused by the schema", async () => {
    await rejects(() => me.caller.location.geoFromUrl({ url: "" }), "BAD_REQUEST");
    await rejects(
      () => me.caller.location.geoFromUrl({ url: `https://example.com/${"x".repeat(2000)}` }),
      "BAD_REQUEST",
    );
    assert.deepEqual(requestsMade(), []);
  });
});

/* -------------------------------------------------------------------------
 * getRoute
 * ---------------------------------------------------------------------- */

describe("getRoute — the directions proxy", () => {
  test("a saved place in another space is refused, and the same id from its owner is not", async () => {
    /*
     * The isolation seam, proved by the DIFFERENCE between two errors rather
     * than by one of them.
     *
     * A refusal on its own proves nothing here: with no routing key every
     * call fails somehow, so "the outsider got an error" would pass even if
     * the lookup were unscoped. What shows the guard is real is that the
     * owner's identical call fails LATER — it gets past the database and dies
     * at the provider — while the outsider's never leaves the query.
     */
    const id = await seedPlace(me.spaceId);

    const refused = await rejects(
      () => outsider.caller.location.getRoute({ origin: SAIGON, destinationId: id }),
      "NOT_FOUND",
    );
    assert.equal(refused.message, "NO_DESTINATION_GEO");

    /*
     * The owner gets PAST the lookup and is stopped by the missing routing
     * key instead — which is how this test tells "refused because it is not
     * yours" apart from "refused because routing is off". Those two must not
     * be the same answer, or the isolation check proves nothing.
     */
    const owner = await rejects(
      () => me.caller.location.getRoute({ origin: SAIGON, destinationId: id }),
      "PRECONDITION_FAILED",
    );
    assert.equal(owner.message, "ROUTING_UNAVAILABLE");
  });

  test("both partners in one space reach the same saved place", async () => {
    /*
     * The other half of isolation, and the half that breaks quietly: scoping
     * by the caller's USER id instead of their space would pass every
     * outsider test above and still stop the person who was invited from
     * navigating to a place their partner saved.
     */
    const couple = await makeCouple({ a: "Mai", b: "Nam", spaceName: "Góc chung" });
    const id = await seedPlace(couple.spaceId);
    for (const [who, caller] of [["A", couple.a.caller], ["B", couple.b.caller]] as const) {
      const err = await rejects(
        () => caller.location.getRoute({ origin: SAIGON, destinationId: id }),
        "PRECONDITION_FAILED",
      );
      assert.equal(err.message, "ROUTING_UNAVAILABLE", `${who} did not get past the lookup`);
    }
  });

  test("an id that is not an ObjectId is a clean refusal, not a 500", async () => {
    /*
     * It used to reach Mongoose, which threw a CastError before the handler's
     * own checks could run — so plainly-wrong input became
     * INTERNAL_SERVER_ERROR, an alert in every dashboard, and a message that
     * disclosed the model name and the id format. The empty-string case
     * already answered cleanly; now the rest matches it.
     */
    const err = await rejects(
      () => me.caller.location.getRoute({ origin: SAIGON, destinationId: "khong-phai-objectid" }),
      "BAD_REQUEST",
    );
    assert.equal(err.message, "BAD_DESTINATION");
    assert.ok(!/Cast to ObjectId|Location/.test(err.message), "and it leaks no internals");
  });

  test("a well-formed id for a place that does not exist is a clean NOT_FOUND", async () => {
    // Same 24-hex shape, no row behind it: the normal case after somebody
    // deletes a place on the other phone while this one still has it open.
    const err = await rejects(
      () =>
        me.caller.location.getRoute({
          origin: SAIGON,
          destinationId: new mongoose.Types.ObjectId().toString(),
        }),
      "NOT_FOUND",
    );
    assert.equal(err.message, "NO_DESTINATION_GEO");
  });

  test("a saved place with no coordinate is NOT_FOUND, not a route to nowhere", async () => {
    // Places added by name alone have no `geo`. Routing to `undefined` would
    // otherwise send `{lat: undefined}` to the provider and get back
    // something unrelated.
    const id = await seedPlace(me.spaceId, { name: "Chưa có toạ độ", geo: undefined });
    const err = await rejects(
      () => me.caller.location.getRoute({ origin: SAIGON, destinationId: id }),
      "NOT_FOUND",
    );
    assert.equal(err.message, "NO_DESTINATION_GEO");
  });

  test("neither a destination nor an id is a clean refusal naming what is missing", async () => {
    // Both fields are optional in the schema because either one will do; the
    // handler is what enforces "at least one", so that check is the schema
    // here and deserves a test of its own.
    for (const input of [{ origin: SAIGON }, { origin: SAIGON, destinationId: "" }]) {
      const err = await rejects(() => me.caller.location.getRoute(input), "BAD_REQUEST");
      assert.equal(err.message, "NO_DESTINATION");
    }
    assert.deepEqual(requestsMade(), []);
  });

  test("a malformed origin is refused before the database is touched", async () => {
    await rejects(
      () =>
        me.caller.location.getRoute({
          origin: asClientSent({ lat: "10.7", lng: 106.7 }),
          destination: THU_DUC,
        }),
      "BAD_REQUEST",
    );
    await rejects(
      () => me.caller.location.getRoute({ origin: asClientSent({ lat: NaN, lng: 0 }), destination: THU_DUC }),
      "BAD_REQUEST",
    );
  });

  test("with no routing key it says routing is off, not that the server broke", async () => {
    /*
     * The one procedure of the eight that did not degrade. `requireEnv` threw
     * a plain Error, so an unset variable arrived as INTERNAL_SERVER_ERROR —
     * a missing config looking like a crash in every dashboard — and the
     * message carried the variable's NAME to the client.
     *
     * There is still no meaningful half-answer to "how do I get there", so it
     * still refuses. What changed is the shape: a typed refusal the client can
     * phrase, and nothing internal in it.
     */
    const err = await rejects(
      () => me.caller.location.getRoute({ origin: SAIGON, destination: THU_DUC }),
      "PRECONDITION_FAILED",
    );
    assert.equal(err.message, "ROUTING_UNAVAILABLE");
    assert.ok(!err.message.includes("STADIA"), "and it no longer names an environment variable");
  });
});

/* -------------------------------------------------------------------------
 * rankMeetingPoints
 * ---------------------------------------------------------------------- */

describe("rankMeetingPoints — which candidate splits the journey fairly", () => {
  test("with no routing key it ranks nothing rather than failing the screen", async () => {
    /*
     * The contrast with getRoute above, and the better of the two shapes.
     * `travelSeconds` wraps its own `requireEnv` in a try/catch and returns
     * null, so an unreachable candidate drops out of the ranking instead of
     * taking the request with it. With no key every candidate drops out and
     * the answer is an honest empty list.
     */
    const out = await me.caller.location.rankMeetingPoints({
      origins: [SAIGON, THU_DUC],
      candidates: [
        { id: "a", geo: { lat: 10.81, lng: 106.73 } },
        { id: "b", geo: { lat: 10.82, lng: 106.74 } },
      ],
    });
    assert.deepEqual(out, []);
    assert.deepEqual(requestsMade(), [], "no key means no call, not a call that fails");
  });

  test("the candidate cap holds, because each one costs two routing calls", async () => {
    /*
     * Three candidates is six paid requests. Without the cap one tRPC call
     * fans out without limit on a provider that bills per request — the same
     * class of hole the places allowance exists to close.
     */
    const candidate = (i: number) => ({ id: `c${i}`, geo: { lat: 10.7 + i / 100, lng: 106.6 } });
    await me.caller.location.rankMeetingPoints({
      origins: [SAIGON, THU_DUC],
      candidates: [1, 2, 3].map(candidate),
    });
    const tooMany = await rejects(
      () =>
        me.caller.location.rankMeetingPoints({
          origins: [SAIGON, THU_DUC],
          candidates: [1, 2, 3, 4].map(candidate),
        }),
      "BAD_REQUEST",
    );
    assert.ok(tooMany.message.includes("too_big"));

    const none = await rejects(
      () => me.caller.location.rankMeetingPoints({ origins: [SAIGON, THU_DUC], candidates: [] }),
      "BAD_REQUEST",
    );
    assert.ok(none.message.includes("too_small"), "and an empty ask is a refusal, not six calls");
  });

  test("it takes exactly two origins — a meeting point between one person is nothing", async () => {
    // A tuple, not an array: the whole output is the gap between two travel
    // times, so a list of any other length has no meaning to compute.
    await rejects(
      () =>
        me.caller.location.rankMeetingPoints({
          origins: asClientSent([SAIGON]),
          candidates: [{ id: "c", geo: THU_DUC }],
        }),
      "BAD_REQUEST",
    );
    await rejects(
      () =>
        me.caller.location.rankMeetingPoints({
          origins: [SAIGON, asClientSent({ lat: "x", lng: 1 })],
          candidates: [{ id: "c", geo: THU_DUC }],
        }),
      "BAD_REQUEST",
    );
    await rejects(
      () =>
        me.caller.location.rankMeetingPoints({
          origins: [SAIGON, THU_DUC],
          candidates: [{ id: "", geo: THU_DUC }],
        }),
      "BAD_REQUEST",
    );
  });

  test("a candidate id from another space is NOT refused — it is never looked up", async () => {
    /*
     * Documented so the absence is deliberate rather than assumed.
     *
     * Unlike getRoute, this procedure never reads the row behind `id`: the
     * handler destructures `{ input }` only (no `ctx`, see
     * src/server/trpc/routers/location.ts:430) and the caller supplies the
     * coordinate itself. The id is an opaque label echoed back so the client
     * can match a score to the card it drew.
     *
     * So there is no space check and nothing to leak: passing another space's
     * location id buys back nothing that was not sent in. That holds only
     * while the id stays unused — the moment this procedure looks a candidate
     * up to read its coordinate, it needs the same `spaceId` filter getRoute
     * has, and this test is where that change has to be noticed.
     */
    const foreign = await seedPlace(me.spaceId, { name: "Bí mật của Linh" });
    const out = await outsider.caller.location.rankMeetingPoints({
      origins: [SAIGON, THU_DUC],
      candidates: [{ id: foreign, geo: { lat: 10.8, lng: 106.7 } }],
    });
    assert.deepEqual(out, [], "nothing from the other space's row may come back");
    assert.deepEqual(requestsMade(), []);
  });
});

/* -------------------------------------------------------------------------
 * The audit this whole file rests on
 * ---------------------------------------------------------------------- */

describe("the suite itself", () => {
  test("never reached a third party it did not mean to", async () => {
    /*
     * The ledger, checked once at the end.
     *
     * Every request above was intercepted, so nothing actually left this
     * machine — but WHICH hosts the code reached for is the thing that would
     * silently regress. A new provider wired into one of these procedures, or
     * a key that stops being cleared, shows up here as an unexpected hostname
     * long before it shows up as a bill or a rate-limit ban.
     */
    const expected = new Set(["nominatim.openstreetmap.org", "maps.app.goo.gl"]);
    const unexpected = [...HOSTS_EVER].filter((h) => !expected.has(h));
    assert.deepEqual(
      unexpected,
      [],
      `an unexpected host was contacted: ${unexpected.join(", ")}. Either a provider was added or a key stopped being cleared in tests/api/_env.ts.`,
    );
  });
});
