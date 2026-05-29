import type { CatalogGame } from "@/contentPacks/catalog"
import type { UserClass } from "@/store/settings"

/** Cold-start curated order (mirrors the old DiscoverPacksPanel featured set). */
export const FEATURED_PACK_IDS = [
  "earthgate_reader",
  "stargate_reader",
  "hover_runner",
  "hanzipan",
  "pronunciation_coach",
  "juice_squeeze",
  "world_radio",
]

/** Per-journey emphasis — what to surface first for each kind of user. */
const BY_CLASS: Record<UserClass, string[]> = {
  enjoyer: ["earthgate_reader", "stargate_reader", "world_radio", "juice_squeeze"],
  kid_native: ["earthgate_reader", "stargate_reader", "hover_runner"],
  learner: ["pronunciation_coach", "earthgate_reader", "juice_squeeze", "hover_runner"],
  polyglot: ["earthgate_reader", "stargate_reader", "pronunciation_coach", "hanzipan", "world_radio"],
}

/**
 * Pure, deterministic, network-free ranking of catalog experiences for the
 * Home "For you" shelf. Class-preferred order first, then the curated featured
 * tail, excluding anything already installed. (Phrase experience is surfaced
 * separately as the hero, so it's never in this list.)
 */
export function recommend(
  catalog: CatalogGame[],
  opts: { userClass: UserClass | null; installedIds: Set<string> }
): CatalogGame[] {
  const order = [
    ...((opts.userClass && BY_CLASS[opts.userClass]) || []),
    ...FEATURED_PACK_IDS,
  ]
  const byId = new Map(catalog.map((g) => [g.id, g]))
  const seen = new Set<string>()
  const out: CatalogGame[] = []
  for (const id of order) {
    if (seen.has(id) || opts.installedIds.has(id)) continue
    const g = byId.get(id)
    if (g) {
      seen.add(id)
      out.push(g)
    }
  }
  return out
}
