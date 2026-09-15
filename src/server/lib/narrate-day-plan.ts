import {
  buildNarrationPrompt,
  parseNarration,
  type Narration,
  type NarrationFact,
} from "@/lib/day-plan-narration";

/**
 * Asking a model to write the plan's words — and never waiting on it.
 *
 * Every failure here is the same failure: the caller keeps the sentences it
 * already had. No key, no provider, a slow answer, a broken answer, an answer
 * that invented a restaurant — all of them return null, and the plan comes out
 * whole either way. That is the discipline `sendNavInvite` follows for push,
 * and the reason this phase could be dropped entirely without the feature
 * losing anything but polish.
 *
 * **No provider is chosen yet, deliberately.** Free tiers and their limits
 * change every few months, so picking one while writing a plan is picking from
 * memory. What is here is the adapter, the prompt, the validator and the
 * fallback; naming a provider means putting a key in the environment and
 * measuring what it actually allows. Until then `DAY_PLAN_LLM_URL` is unset
 * and this returns null on its first line, which is a supported state with a
 * test of its own.
 */

/** Two seconds. Past that the plan is better late than pretty. */
const TIMEOUT_MS = 2_000;

/** Narrations are cached by the places they describe, so a swap costs nothing. */
const cache = new Map<string, Narration>();
const CACHE_MAX = 300;

/*
 * Keyed by SPACE, and by the whole fact — not just the place names.
 *
 * The first version keyed on titles and vibe alone, in a process-wide map. Two
 * couples near the same corner get the same places from the shared search
 * cache, in the same order, so couple B could be served sentences the model
 * wrote from couple A's facts — and those facts include `mustTry`, which is
 * free text one of them typed about a place. Display-only, and dormant while
 * no provider is configured, but it is somebody's private note leaving their
 * space, which is not a thing to leave in place because it is currently
 * unreachable.
 */
function cacheKey(spaceId: string, facts: NarrationFact[], vibe?: string | null): string {
  const shape = facts.map((f) => `${f.title}\u0000${f.kind}\u0000${f.reason}`).join("\u0001");
  return `${spaceId}|${vibe ?? ""}|${shape}`;
}

export type NarrateOutcome = {
  narration: Narration | null;
  /** Why there is nothing, for logs and for tests. Never shown to anybody. */
  reason: "ok" | "cached" | "no-provider" | "timeout" | "http" | "rejected";
};

/**
 * An OpenAI-shaped chat completion, which is what every free tier speaks.
 *
 * Kept behind two plain environment variables rather than a provider SDK: the
 * one thing known for certain about this choice is that it will change, and a
 * URL plus a model name can be repointed without a deploy-shaped decision.
 */
export async function narrateDayPlan(
  spaceId: string,
  facts: NarrationFact[],
  vibe?: string | null,
): Promise<NarrateOutcome> {
  if (!facts.length) return { narration: null, reason: "no-provider" };

  const key = cacheKey(spaceId, facts, vibe);
  const hit = cache.get(key);
  if (hit) return { narration: hit, reason: "cached" };

  const url = process.env.DAY_PLAN_LLM_URL;
  const token = process.env.DAY_PLAN_LLM_KEY;
  const model = process.env.DAY_PLAN_LLM_MODEL;
  if (!url || !token || !model) return { narration: null, reason: "no-provider" };

  const ctrl = new AbortController();
  const deadline = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        model,
        temperature: 0.8,
        messages: [{ role: "user", content: buildNarrationPrompt(facts, vibe) }],
      }),
    });
    if (!res.ok) return { narration: null, reason: "http" };
    const body = (await res.json().catch(() => null)) as
      | { choices?: Array<{ message?: { content?: string } }> }
      | null;
    const raw = body?.choices?.[0]?.message?.content;
    if (typeof raw !== "string") return { narration: null, reason: "http" };

    const parsed = parseNarration(raw, facts);
    if (!parsed.ok) {
      // Worth a log line: a model that started inventing places is something
      // to notice, not something to silently tolerate forever.
      console.warn("narrateDayPlan: answer refused —", parsed.reason);
      return { narration: null, reason: "rejected" };
    }
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
    cache.set(key, parsed.value);
    return { narration: parsed.value, reason: "ok" };
  } catch {
    return { narration: null, reason: "timeout" };
  } finally {
    clearTimeout(deadline);
  }
}

/** Test seam: the cache is process-wide and would leak between suites. */
export function __clearNarrationCache() {
  cache.clear();
}
