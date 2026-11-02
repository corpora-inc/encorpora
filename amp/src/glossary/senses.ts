import type { GlossarySenses } from "./types";

/** A shared sense map without some forms: for a method or lesson whose own
 * text (or its template's) uses those words in another meaning. Names the
 * exception where it applies instead of listing the form in `noLink` too,
 * which would silently mute the sense (`tests/glossary-contexts.test.ts`). */
export function sensesWithout(
  senses: GlossarySenses,
  ...forms: string[]
): GlossarySenses {
  return Object.fromEntries(
    Object.entries(senses).filter(([form]) => !forms.includes(form)),
  );
}
