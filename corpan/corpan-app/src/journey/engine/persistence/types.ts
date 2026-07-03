// journey/engine/persistence/types.ts — re-exports EnginePersistence
// (normative home: specs/storage-analytics.md §3.7 → src/lib/storage) and
// owns what engine.md §3.1 assigns here: ItemCardRecord + its codec.
//
// Type-only imports from @/lib/storage (erased at compile time — §0 rule 1).

import type { DocCodec, EnginePersistence } from "@/lib/storage"
import { ENGINE_SCHEMA, MAX_EPOCH_DAY } from "../constants.ts"
import type { ItemCard } from "../types.ts"

export type { EnginePersistence, DocCodec }

/** The engine's persistence view: ItemCard docs + the shared analytics log
 *  (read-only here; the runtime is the one writer — R15) + small meta KV. */
export type JourneyPersistence = EnginePersistence<ItemCard, unknown>

/** ItemCardRecord = ItemCard (§2.1); doc id = itemId. */
export type ItemCardRecord = ItemCard

function isInt(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v)
}
function isFiniteNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

/** Structural validation — hand-rolled predicates, no zod (engine.md §3.1).
 *  Invalid ⇒ null: dropped + counted by the storage doctor, then rebuilt by
 *  the recovery ladder (§3.5). */
export function parseItemCard(raw: unknown): ItemCard | null {
  if (typeof raw !== "object" || raw === null) return null
  const rec = raw as Partial<ItemCard>
  if (typeof rec.itemId !== "string" || rec.itemId.length === 0) return null
  if (!isInt(rec.flags) || rec.flags < 0) return null
  if (rec.form !== 0 && rec.form !== 1 && rec.form !== 2) return null
  const f = rec.fsrs as Partial<ItemCard["fsrs"]> | undefined
  if (typeof f !== "object" || f === null) return null
  if (!isFiniteNum(f.s) || f.s < 0) return null
  if (!isFiniteNum(f.d)) return null
  if (!isInt(f.due) || f.due < 0 || f.due > MAX_EPOCH_DAY) return null
  if (!isInt(f.last) || f.last < 0 || f.last > MAX_EPOCH_DAY) return null
  if (!isInt(f.reps) || f.reps < 0) return null
  if (!isInt(f.lapses) || f.lapses < 0) return null
  if (f.state !== 0 && f.state !== 1 && f.state !== 2 && f.state !== 3) return null
  // reviewed cards must carry sane FSRS memory state
  if (f.state !== 0 && (f.s <= 0 || f.d < 1 || f.d > 10)) return null
  if (f.state === 0 && (f.d < 0 || f.d > 10)) return null
  return {
    itemId: rec.itemId,
    fsrs: { s: f.s, d: f.d, due: f.due, last: f.last, reps: f.reps, lapses: f.lapses, state: f.state },
    flags: rec.flags,
    form: rec.form,
  }
}

/** MANDATORY migrate hook (FSRS card loss = re-placement — recoverable but
 *  expensive). Schema 1 is the first shipped version, so there is nothing to
 *  upgrade FROM yet; records from a NEWER version (app rolled back) fail
 *  parse at the storage layer and are rebuilt by the ladder — never guessed. */
export const itemCardCodec: DocCodec<ItemCard> = {
  schemaVersion: ENGINE_SCHEMA,
  parse: parseItemCard,
  migrate(raw: unknown, fromVersion: number): ItemCard | null {
    if (fromVersion === ENGINE_SCHEMA) return parseItemCard(raw)
    // future versions add explicit per-version upgrades here
    return null
  },
}
