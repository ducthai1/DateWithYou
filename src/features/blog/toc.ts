import { slugify } from "@/lib/slug";

export type TocItem = { id: string; text: string; level: 2 | 3 };

/**
 * Give the article's H2/H3 stable ids and pull a table of contents from them.
 *
 * Runs on the server over the stored HTML, and the body it returns is what the
 * page renders — so the anchor links land on real ids. It's a regex, not a DOM
 * parser: the body is our own editor's output, a small controlled subset of
 * HTML, and pulling in a parser for it would be weight for no gain.
 */
export function withHeadingAnchors(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  const used = new Set<string>();

  const out = html.replace(/<h([23])([^>]*)>([\s\S]*?)<\/h\1>/gi, (whole, lvl, attrs, inner) => {
    const text = String(inner).replace(/<[^>]+>/g, "").trim();
    if (!text) return whole;
    const base = slugify(text) || `muc-${toc.length + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
    used.add(id);
    toc.push({ id, text, level: Number(lvl) as 2 | 3 });
    // Keep the heading's own attributes but drop any prior id so ours is unique.
    const cleaned = String(attrs).replace(/\sid="[^"]*"/i, "");
    return `<h${lvl}${cleaned} id="${id}">${inner}</h${lvl}>`;
  });

  return { html: out, toc };
}
