import { NextRequest } from "next/server";
import { auth } from "@/server/auth/auth";
import { connectToDatabase } from "@/server/db/connect";
import { SpaceModel } from "@/server/db/models/space";
import { NavigationInviteModel } from "@/server/db/models/navigation-invite";
import { LiveLocationModel } from "@/server/db/models/live-location";

/**
 * SSE endpoint for navigation invites.
 *
 * Instead of the client polling every 3-4 seconds, the server keeps a single
 * HTTP connection open and only pushes data when the invite status *actually
 * changes*. The browser reconnects automatically on network glitches via the
 * native EventSource API.
 *
 * Each tick of the server loop (every 3 s) is a lightweight single-document
 * MongoDB query (indexed) — far cheaper than N client-initiated HTTP round
 * trips because:
 *   1. There is exactly ONE connection per browser tab, not one per poll.
 *   2. No TCP/TLS handshake overhead on every check.
 *   3. No request parsing / response serialisation overhead.
 *   4. The query only runs while the SSE connection is alive.
 */

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // ── Auth ──
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }
  const userId = session.user.id;

  // ── Resolve space ──
  await connectToDatabase();
  const cookieStr = req.headers.get("cookie");
  let activeSpaceId: string | null = null;
  if (cookieStr) {
    // Anchor on a cookie boundary + decode, matching the tRPC context parser.
    const match = cookieStr.match(/(?:^|;\s*)active_space_id=([^;]+)/);
    if (match) activeSpaceId = decodeURIComponent(match[1]);
  }

  let space;
  if (activeSpaceId) {
    space = await SpaceModel.findOne({
      _id: activeSpaceId,
      members: userId,
    })
      .select("_id")
      .lean<{ _id: unknown }>();
  }
  if (!space) {
    space = await SpaceModel.findOne({ members: userId })
      .select("_id")
      .lean<{ _id: unknown }>();
  }
  if (!space) {
    return new Response("No space", { status: 403 });
  }
  const spaceId = String(space._id);

  // ── SSE stream ──
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      // Send a heartbeat immediately so the client knows the connection is live.
      send("heartbeat", { ts: Date.now() });

      // Track the last known state so we only push on *change*.
      let lastInviteId: string | null = null;
      let lastStatus: string | null = null;
      // Also track invites the current user SENT (to know when accepted).
      // Also track invites the current user SENT (to know when accepted).
      let lastSentInviteId: string | null = null;
      let lastSentStatus: string | null = null;
      
      // Track the partner's last ping action time to avoid duplicate pushes
      let lastPartnerPingAt = 0;
      // Track the last "trip ended" invite we notified about (push once).
      let lastEndedId: string | null = null;

      const poll = async () => {
        if (closed) return;
        try {
          // 1. Check for pending invites targeting this user.
          const incoming = await NavigationInviteModel.findOne({
            spaceId,
            targetId: userId,
            status: "pending",
          }).lean<{
            _id: unknown;
            initiatorId: string;
            locationId: string;
            locationName: string;
            status: string;
            waypoints: unknown[];
            merged: boolean;
          }>();

          const inId = incoming ? String(incoming._id) : null;
          const inStatus = incoming?.status ?? null;

          if (inId !== lastInviteId || inStatus !== lastStatus) {
            const prevInviteId = lastInviteId;
            lastInviteId = inId;
            lastStatus = inStatus;
            if (incoming) {
              send("invite", {
                id: String(incoming._id),
                initiatorId: incoming.initiatorId,
                locationId: incoming.locationId,
                locationName: incoming.locationName,
                status: incoming.status,
                waypoints: incoming.waypoints,
                merged: incoming.merged,
              });
            } else if (prevInviteId) {
              // A previously-pending invite is gone (sender cancelled, it was
              // responded to elsewhere, or it TTL-expired). Tell the client so the
              // incoming-invite modal dismisses instead of sticking on a dead
              // invite whose Accept/Decline now 404.
              send("invite-cancelled", { id: prevInviteId });
            }
          }

          // 2. Check invites this user SENT — to detect acceptance.
          const sent = await NavigationInviteModel.findOne({
            spaceId,
            initiatorId: userId,
            status: { $in: ["pending", "accepted", "rejected"] },
          })
            .sort({ createdAt: -1 })
            .lean<{
              _id: unknown;
              targetId: string;
              locationId: string;
              locationName: string;
              status: string;
              waypoints: unknown[];
              merged: boolean;
            }>();

          const sentId = sent ? String(sent._id) : null;
          const sentStatus = sent?.status ?? null;

          if (sentId !== lastSentInviteId || sentStatus !== lastSentStatus) {
            lastSentInviteId = sentId;
            lastSentStatus = sentStatus;
            // Only push a response event when the invite has been acted on.
            // Emitting "pending" here is a no-op for the sender and only adds
            // noise — the sender already knows it sent the invite.
            if (sent && sent.status !== "pending") {
              send("invite-response", {
                id: String(sent._id),
                targetId: sent.targetId,
                locationId: sent.locationId,
                locationName: sent.locationName,
                status: sent.status,
                waypoints: sent.waypoints,
                merged: sent.merged,
              });
            }
          }

          // 2b. Detect the partner ending a shared trip → prompt this user.
          const endedTrip = await NavigationInviteModel.findOne({
            spaceId,
            status: "ended",
            $or: [{ initiatorId: userId }, { targetId: userId }],
          })
            .sort({ updatedAt: -1 })
            .lean<{ _id: unknown; endedBy?: string; locationName: string }>();

          const endedId = endedTrip ? String(endedTrip._id) : null;
          if (endedId && endedId !== lastEndedId) {
            lastEndedId = endedId;
            // Notify only the partner who did NOT press end.
            if (endedTrip?.endedBy && endedTrip.endedBy !== userId) {
              send("trip-ended", { id: endedId, locationName: endedTrip.locationName });
            }
          }

          // 3. Check for recent partner pings (within the last 10 seconds)
          const fiveMinsAgo = new Date(Date.now() - 5 * 60 * 1000);
          const partnerLoc = await LiveLocationModel.findOne({
            spaceId,
            userId: { $ne: userId },
            updatedAt: { $gt: fiveMinsAgo }
          })
            .select("pingAction updatedAt")
            .lean<{ pingAction: string | null; updatedAt: Date }>();
          
          if (partnerLoc && partnerLoc.pingAction) {
            const updatedAtMs = partnerLoc.updatedAt.getTime();
            // Repeat-suppression invariant: a ping is emitted at most once per
            // partner location write (updatedAt strictly newer than last sent)
            // AND only inside a 10s freshness window. This is what stops a
            // stale pingAction (paths that don't send pingAction:null, e.g.
            // Meet-Me-Halfway, leave the stored value untouched) from re-firing
            // every poll — do NOT remove either guard.
            if (updatedAtMs > lastPartnerPingAt && (Date.now() - updatedAtMs) < 10000) {
              lastPartnerPingAt = updatedAtMs;
              send("ping", { action: partnerLoc.pingAction, ts: updatedAtMs });
            }
          }
        } catch (err) {
          console.error("[SSE nav-invite poll]", err);
        }
      };

      // Prime trackers from the state that ALREADY exists when this connection
      // opens, so events resolved before now aren't replayed as fresh ones on
      // every (re)connect — each page load / EventSource reconnect starts a new
      // stream with null trackers. Without this, the sender's last "accepted"
      // invite (alive ~6h) re-fires on every load and force-navigates them into a
      // finished trip behind the full-screen nav overlay; likewise a finished
      // ("ended") trip re-opens the "partner ended — stop too?" prompt.
      //
      // A short grace window keeps a genuinely-recent change deliverable: if the
      // accept/end landed during a brief reconnect blip (within the window), it is
      // NOT primed away, so the first poll still emits it once. The client de-dupes
      // by invite id, so a steady connection never double-handles it.
      const CONNECT_GRACE_MS = 20_000;
      const isStale = (updatedAt?: Date | null) =>
        !!updatedAt && Date.now() - new Date(updatedAt).getTime() > CONNECT_GRACE_MS;
      try {
        const primeSent = await NavigationInviteModel.findOne({
          spaceId,
          initiatorId: userId,
          status: { $in: ["pending", "accepted", "rejected"] },
        })
          .sort({ createdAt: -1 })
          .select("_id status updatedAt")
          .lean<{ _id: unknown; status: string; updatedAt: Date }>();
        // Suppress an old resolved invite. A pending one is primed too (pending
        // never emits a response anyway, and a later accept still fires); a
        // recently-resolved one is left unprimed so a reconnect-gap accept emits.
        if (primeSent && (primeSent.status === "pending" || isStale(primeSent.updatedAt))) {
          lastSentInviteId = String(primeSent._id);
          lastSentStatus = primeSent.status;
        }
        const primeEnded = await NavigationInviteModel.findOne({
          spaceId,
          status: "ended",
          $or: [{ initiatorId: userId }, { targetId: userId }],
        })
          .sort({ updatedAt: -1 })
          .select("_id updatedAt")
          .lean<{ _id: unknown; updatedAt: Date }>();
        if (primeEnded && isStale(primeEnded.updatedAt)) {
          lastEndedId = String(primeEnded._id);
        }
      } catch {
        /* priming is best-effort — the poll loop below still runs normally */
      }

      // Initial check, then every 1 second. Trade-off: ~50% more DB polls per
      // connection vs. ~500 ms lower invite/ping delivery latency. Acceptable for
      // a couples app with at most 2 concurrent SSE connections per space.
      await poll();
      const interval = setInterval(poll, 1000);

      // Clean up when the client disconnects.
      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Nginx / Vercel: don't buffer the stream.
    },
  });
}
