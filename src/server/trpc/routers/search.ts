import { z } from "zod";
import { router, protectedProcedure } from "@/server/trpc/trpc";
import { connectToDatabase } from "@/server/db/connect";
import { MemoryModel } from "@/server/db/models/memory";
import { LocationModel } from "@/server/db/models/location";
import { MediaItemModel } from "@/server/db/models/media-item";
import { PlanItemModel } from "@/server/db/models/plan-item";
import { TripModel } from "@/server/db/models/trip";
import { buildPattern } from "@/lib/vietnamese-text";

/* ── Vietnamese diacritic-tolerant matching ──────────────────────────
 *
 * Typing "ca phe" must find "cà phê", and typing "cà phê" must find "ca phe".
 *
 * We do that without a shadow field — no migration, no backfill, nothing extra
 * to keep in sync on every write. Instead the *query* is folded down to its
 * unaccented base letters, and each base letter is then expanded back into a
 * character class holding every accented form it can appear as:
 *
 *   "ca phe"  →  [aàáảãạă…AÀÁ…] for a, [eèéẻ…EÈÉ…] for e,
 *                literal c/p, and \s+ between words
 *
 * so one pattern matches both spellings in either direction. It is a flat
 * concatenation of character classes, literals and `\s+` — no nesting and no
 * ambiguous alternation — so it cannot backtrack catastrophically.
 *
 * Anything the user types that is not a base letter is escaped, so a stray "("
 * or "*" is matched literally instead of throwing or becoming a quantifier. */

/** Base letter → every Vietnamese form of it (lowercase; uppercase derived). */
/* ── Snippets ──────────────────────────────────────────────────────────────
 * The server returns the matched character range alongside each string so the
 * client can highlight it without re-deriving the same accent-folding logic. */

type Range = { start: number; end: number };

const SNIPPET_PAD = 48;
const SNIPPET_MAX = 140;

function firstMatch(rx: RegExp, text: string): Range | null {
  const m = rx.exec(text);
  return m ? { start: m.index, end: m.index + m[0].length } : null;
}

function truncate(text: string): string {
  return text.length > SNIPPET_MAX
    ? `${text.slice(0, SNIPPET_MAX).trimEnd()}…`
    : text;
}

type FieldSnippet = { snippet: string; snippetMatch: Range | null; matched: boolean };

/**
 * Collapse a field to one line, then window it around the match. Whitespace is
 * collapsed *before* matching so the returned offsets index the string the
 * client actually renders.
 */
function fieldSnippet(rx: RegExp, raw: unknown): FieldSnippet | null {
  if (typeof raw !== "string") return null;
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;

  const hit = firstMatch(rx, text);
  if (!hit) return { snippet: truncate(text), snippetMatch: null, matched: false };

  const start = Math.max(0, hit.start - SNIPPET_PAD);
  const end = Math.min(text.length, Math.min(hit.end + SNIPPET_PAD, start + SNIPPET_MAX));
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  const body = text.slice(start, end);
  const shift = prefix.length - start;

  return {
    snippet: prefix + body + suffix,
    snippetMatch: {
      start: hit.start + shift,
      end: Math.min(hit.end + shift, prefix.length + body.length),
    },
    matched: true,
  };
}

export type SearchKind = "memory" | "location" | "media" | "plan" | "trip";

export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  titleMatch: Range | null;
  snippet: string | null;
  snippetMatch: Range | null;
  href: string;
};

const UNTITLED = "(chưa đặt tên)";

/**
 * Assemble one result row. `candidates` are the secondary fields, in priority
 * order; the first one that actually matches supplies the highlighted snippet,
 * otherwise the first non-empty one supplies plain context.
 */
function buildHit(
  kind: SearchKind,
  id: string,
  rawTitle: unknown,
  href: string,
  rx: RegExp,
  candidates: unknown[],
): SearchHit {
  const title =
    typeof rawTitle === "string" && rawTitle.trim() ? rawTitle.trim() : UNTITLED;
  const titleMatch = firstMatch(rx, title);

  let fallback: FieldSnippet | null = null;
  for (const candidate of candidates) {
    const s = fieldSnippet(rx, candidate);
    if (!s) continue;
    if (s.matched) {
      return { kind, id, title, titleMatch, snippet: s.snippet, snippetMatch: s.snippetMatch, href };
    }
    if (!fallback) fallback = s;
  }

  return {
    kind,
    id,
    title,
    titleMatch,
    snippet: fallback?.snippet ?? null,
    snippetMatch: null,
    href,
  };
}

/* ── Lean row shapes ───────────────────────────────────────────────────────*/

type MemoryRow = { _id: unknown; title?: string; caption?: string; tags?: string[] };
type LocationRow = { _id: unknown; name?: string; district?: string; note?: string; mustTry?: string };
type MediaRow = { _id: unknown; title?: string; note?: string };
type PlanRow = { _id: unknown; title?: string; note?: string; date?: string };
type TripRow = { _id: unknown; title?: string; description?: string };

export const searchRouter = router({
  /**
   * One accent-tolerant substring query fanned out across every collection the
   * couple can search. `limit` caps each group, so a broad term still returns a
   * usable, bounded page per section instead of drowning one kind in another.
   *
   * All five queries filter on `spaceId` first, and every sort is served by an
   * index the models already declare (`spaceId + date` / `spaceId + createdAt`),
   * so the regex only ever scans this couple's own documents. A non-anchored
   * regex cannot use an index for the match itself, which is why the spaceId
   * prefix — not a new compound index — is what keeps this bounded.
   */
  query: protectedProcedure
    .input(
      z.object({
        q: z.string().trim().min(1).max(80),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const pattern = buildPattern(input.q);
      if (!pattern) return { q: input.q, total: 0, groups: [] };

      await connectToDatabase();
      const rx = new RegExp(pattern, "i");
      const { limit } = input;
      const spaceId = ctx.spaceId;

      const [memories, locations, media, plans, trips] = await Promise.all([
        MemoryModel.find({
          spaceId,
          $or: [{ title: rx }, { caption: rx }, { tags: rx }],
        })
          .select("_id title caption tags")
          .sort({ date: -1 })
          .limit(limit)
          .lean<MemoryRow[]>(),

        LocationModel.find({
          spaceId,
          $or: [{ name: rx }, { district: rx }, { note: rx }, { mustTry: rx }],
        })
          .select("_id name district note mustTry")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<LocationRow[]>(),

        MediaItemModel.find({ spaceId, $or: [{ title: rx }, { note: rx }] })
          .select("_id title note")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<MediaRow[]>(),

        PlanItemModel.find({ spaceId, $or: [{ title: rx }, { note: rx }] })
          .select("_id title note date")
          .sort({ date: -1 })
          .limit(limit)
          .lean<PlanRow[]>(),

        TripModel.find({ spaceId, $or: [{ title: rx }, { description: rx }] })
          .select("_id title description")
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean<TripRow[]>(),
      ]);

      // href deep-links carry the record id as a query hint; the base route is
      // always a real screen, so a target that has not adopted the hint yet
      // still lands the user on the right page.
      const allGroups: { kind: SearchKind; items: SearchHit[] }[] = [
        {
          kind: "memory",
          items: memories.map((d) =>
            buildHit("memory", String(d._id), d.title, `/timeline?memory=${String(d._id)}`, rx, [
              d.caption,
              (d.tags ?? []).join(" · "),
            ]),
          ),
        },
        {
          kind: "location",
          items: locations.map((d) =>
            buildHit("location", String(d._id), d.name, `/map?location=${String(d._id)}`, rx, [
              d.note,
              d.mustTry,
              d.district,
            ]),
          ),
        },
        {
          kind: "media",
          items: media.map((d) =>
            buildHit("media", String(d._id), d.title, `/library?item=${String(d._id)}`, rx, [d.note]),
          ),
        },
        {
          kind: "plan",
          items: plans.map((d) =>
            buildHit(
              "plan",
              String(d._id),
              d.title,
              d.date ? `/calendar?date=${d.date}` : "/calendar",
              rx,
              [d.note, d.date],
            ),
          ),
        },
        {
          kind: "trip",
          items: trips.map((d) =>
            buildHit("trip", String(d._id), d.title, `/trips/${String(d._id)}`, rx, [d.description]),
          ),
        },
      ];
      const groups = allGroups.filter((g) => g.items.length > 0);

      return {
        q: input.q,
        total: groups.reduce((sum, g) => sum + g.items.length, 0),
        groups,
      };
    }),
});
