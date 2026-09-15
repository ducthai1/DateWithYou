/**
 * Letting a model write the words, and nothing else.
 *
 * The division is the whole design: the algorithm decides WHICH places, from
 * the couple's own rows and from Google; a language model may only make the
 * result read nicely. It never sees a decision to make, and nothing it says is
 * allowed to become a fact.
 *
 * Both halves here are pure — building the prompt and judging the answer — so
 * the part that has to be right can be tested from a recorded answer, with no
 * key, no quota and no network. The calling half lives in
 * `src/server/lib/narrate-day-plan.ts`.
 *
 * The discipline is copied from `sendNavInvite`: a push that fails must never
 * lose the invitation. A model that is slow, broken, over quota or absent must
 * never cost anybody their plan — so every failure here returns null and the
 * caller falls back to a written sentence.
 */

export type NarrationFact = {
  /** Exactly as it will be shown. The model may not rename it. */
  title: string;
  kind: string;
  /** The template sentence, so the model has something to improve on. */
  reason: string;
};

export type Narration = {
  /** A name for the day, e.g. "Chiều lười ở Thảo Điền". */
  dayName: string;
  /** One rewritten sentence per stop, in the order given. */
  whys: string[];
};

/** What the model is allowed to be told, and what it is asked for. */
export function buildNarrationPrompt(facts: NarrationFact[], vibe?: string | null): string {
  const list = facts
    .map((f, i) => `${i + 1}. ${f.title} (${f.kind}) — ${f.reason}`)
    .join("\n");
  return [
    "Bạn là người viết lời dẫn cho một ứng dụng hẹn hò của các cặp đôi Việt Nam.",
    "Dưới đây là kế hoạch một buổi đã được chọn sẵn. Việc của bạn CHỈ là viết lời cho dễ thương hơn.",
    "",
    "LUẬT BẮT BUỘC:",
    "- KHÔNG đổi tên quán. Dùng đúng tên đã cho, từng chữ.",
    "- KHÔNG nhắc giờ mở cửa, giá tiền, địa chỉ hay khoảng cách. Bạn không biết những thứ đó.",
    "- Mỗi chặng viết đúng 1 câu, dưới 90 ký tự, tiếng Việt, xưng hô thân mật.",
    "- Trả về JSON thuần: {\"dayName\": \"...\", \"whys\": [\"...\", ...]}",
    "",
    vibe ? `Tâm trạng hôm nay: ${vibe}` : "",
    "Kế hoạch:",
    list,
  ]
    .filter(Boolean)
    .join("\n");
}

/*
 * Things the model is not allowed to claim.
 *
 * It is told not to, and being told is not a guarantee — these are the shapes
 * of the four claims that would be actively harmful if invented: a time, a
 * price, a distance, a street address. A sentence carrying one is thrown away
 * whole rather than edited, because there is no safe way to edit a claim out
 * of a sentence built around it.
 */
/*
 * `\b` is ASCII-only in JavaScript, and every word that matters here is not.
 *
 * The first version of these used `\b` around "giờ" and "đường" and matched
 * neither: `ờ` and `đ` are not word characters, so the boundary the pattern
 * asked for does not exist next to them. "Ghé lúc 7 giờ" and "đường 3 Tháng 2"
 * both sailed through — the two claims most likely to send somebody to the
 * wrong place at the wrong time. Unicode-aware edges, with the `u` flag.
 */
const FORBIDDEN: Array<[name: string, re: RegExp]> = [
  ["giờ giấc", /(^|[^\p{L}\d])\d{1,2}\s*(h\b|giờ|:\d{2})/iu],
  ["giá tiền", /(\d[\d.,]*\s*(k\b|đ|vnd|nghìn|ngàn|triệu))|giá\s+\d/iu],
  ["khoảng cách", /\d+([.,]\d+)?\s*(m\b|km\b|mét|phút)/iu],
  ["địa chỉ", /(^|[^\p{L}])(số|đường|quận|phường)\s+\d/iu],
];

const MAX_WHY = 120;
const MAX_DAY_NAME = 60;

export type NarrationReject =
  | "not-json"
  | "wrong-shape"
  | "count-mismatch"
  | "invented-place"
  | "forbidden-claim"
  | "too-long";

/**
 * Read the model's answer, or refuse it.
 *
 * Refusing is the common path and must stay cheap: the caller simply keeps the
 * sentences it already had. The most important rule is the third one — a
 * sentence naming a place that is not on the plan means the model has invented
 * somewhere, and the entire answer is discarded rather than the one line,
 * because a model that invented once is not trustworthy for the rest.
 */
export function parseNarration(
  raw: string,
  facts: NarrationFact[],
): { ok: true; value: Narration } | { ok: false; reason: NarrationReject } {
  let body: unknown;
  try {
    // Models like to wrap JSON in a fenced block; that is not a reason to fail.
    const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    body = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (typeof body !== "object" || body === null) return { ok: false, reason: "wrong-shape" };
  const obj = body as Record<string, unknown>;
  if (typeof obj.dayName !== "string" || !Array.isArray(obj.whys)) {
    return { ok: false, reason: "wrong-shape" };
  }
  if (obj.whys.length !== facts.length) return { ok: false, reason: "count-mismatch" };
  if (obj.dayName.length > MAX_DAY_NAME) return { ok: false, reason: "too-long" };

  const allowed = facts.map((f) => f.title.toLowerCase());
  const whys: string[] = [];
  for (const why of obj.whys) {
    if (typeof why !== "string") return { ok: false, reason: "wrong-shape" };
    const text = why.trim();
    if (!text || text.length > MAX_WHY) return { ok: false, reason: "too-long" };
    for (const [, re] of FORBIDDEN) {
      if (re.test(text)) return { ok: false, reason: "forbidden-claim" };
    }
    whys.push(text);
  }

  /*
   * A place name that is not on the plan.
   *
   * Checked over the whole answer, including the day's name: "Chiều lười ở
   * Quán Ốc Cô Ba" is an invented recommendation even though no `why` line
   * names it. Quoted names are what a model reaches for when it starts
   * embellishing, so any quoted run that is not one of ours is a rejection.
   */
  const quoted = [...`${obj.dayName} ${whys.join(" ")}`.matchAll(/["“”']([^"“”']{3,60})["“”']/g)]
    .map((m) => m[1].trim().toLowerCase());
  if (quoted.some((q) => !allowed.includes(q))) {
    return { ok: false, reason: "invented-place" };
  }

  return { ok: true, value: { dayName: obj.dayName.trim(), whys } };
}
