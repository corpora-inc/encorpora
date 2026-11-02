import { algebra2Entries } from "./entries/algebra-2";
import { expressionsEquationsEntries } from "./entries/expressions-equations";
import { fractionsEntries } from "./entries/fractions";
import { functionsEntries } from "./entries/functions";
import { geometryEntries } from "./entries/geometry";
import { measurementEntries } from "./entries/measurement";
import { numberEntries } from "./entries/number";
import { ratioEntries } from "./entries/ratio";
import { statisticsProbabilityEntries } from "./entries/statistics-probability";
import { trigPrecalcEntries } from "./entries/trig-precalc";
import type { GlossaryEntry, TermId } from "./types";

/** Every glossary entry, grouped by strand. `tests/glossary.test.ts` checks
 * the whole set: ids, forms, bands, and the acyclic `uses` graph. */
export const glossaryStrands: Readonly<
  Record<string, readonly GlossaryEntry[]>
> = {
  number: numberEntries,
  fractions: fractionsEntries,
  ratio: ratioEntries,
  "expressions-equations": expressionsEquationsEntries,
  geometry: geometryEntries,
  measurement: measurementEntries,
  "statistics-probability": statisticsProbabilityEntries,
  functions: functionsEntries,
  "algebra-2": algebra2Entries,
  "trig-precalc": trigPrecalcEntries,
};

export const glossary: readonly GlossaryEntry[] =
  Object.values(glossaryStrands).flat();

const byId = new Map<TermId, GlossaryEntry>(
  glossary.map((entry) => [entry.id, entry]),
);

export const hasGlossaryEntry = (id: TermId) => byId.has(id);

export function glossaryEntry(id: TermId): GlossaryEntry {
  const entry = byId.get(id);
  if (!entry) throw new Error(`Unknown glossary term ${id}`);
  return entry;
}
