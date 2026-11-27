import type { Section, Segment } from "./types.ts";
import { normalizeSpace } from "./text.ts";

export interface CheckResult {
  body: Segment[];
  quotes_ok: boolean;
  cites_ok: boolean;
  dropped: number;
  citations: string[];
}

/**
 * The support check (CONTRACT): a quote must be a verbatim substring of its
 * section's text and a cite must name a real section. Failing segments are
 * dropped. An answer left with no supporting segment keeps no claims at all.
 */
export function checkBody(body: readonly Segment[], sections: ReadonlyMap<string, Section>): CheckResult {
  let quotesOk = true;
  let citesOk = true;
  let dropped = 0;
  const kept: Segment[] = [];
  for (const seg of body) {
    if (seg.t === "quote") {
      const s = sections.get(seg.section_id);
      if (!s || !normalizeSpace(s.text).includes(normalizeSpace(seg.text))) {
        quotesOk = false;
        dropped++;
        continue;
      }
    } else if (seg.t === "cite") {
      if (!sections.has(seg.section_id)) {
        citesOk = false;
        dropped++;
        continue;
      }
    }
    kept.push(seg);
  }
  const supported = kept.some((s) => s.t === "quote" || s.t === "cite");
  const finalBody = supported ? kept : [];
  if (!supported) dropped += kept.length;
  const citations = [...new Set(finalBody.flatMap((s) => (s.t === "quote" || s.t === "cite" ? [s.section_id] : [])))];
  return { body: finalBody, quotes_ok: quotesOk, cites_ok: citesOk, dropped, citations };
}
