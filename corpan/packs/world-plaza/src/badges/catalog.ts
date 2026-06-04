/**
 * Badge CATALOG — the generative taxonomy (BADGES_PROGRESSION §1).
 *
 * Badges are NOT hand-authored. A small set of family GENERATORS stamp badges
 * from corpus facets: {domain} × {CEFR} × {skill family} × {subtopic cluster} ×
 * {tool}, pruned to where the corpus has content, lands at ≈1000 per language.
 *
 * STABLE IDS ARE LOAD-BEARING (§7.5): a badgeId is derived purely from its facets
 * (`F:travel:vocab:A2`, `A:travel`, `G:social:greetings`, `H:word-scramble`), so
 * regenerating the catalog yields identical ids and progress NEVER orphans.
 *
 * The catalog is DATA (never persisted): regenerated at boot from the bundled /
 * CDN family templates + the per-language coverage matrix. Only PROGRESS persists.
 *
 * B0 ships a TRIMMED ~40-badge ES set (`buildCatalog` over the B0 coverage); the
 * GENERATOR STRUCTURE (`generateCatalog`) is the full B1 fan-out the same code
 * path drives — feed it the real corpus coverage matrix and it emits ~1000.
 */

import type { Badge, BadgeFamily, ChallengeToolId } from "@world-plaza/contracts"
import familiesJson from "../../content/badges/families.json"
import skillFamiliesJson from "../../content/badges/skillFamilies.json"
import subtopicClustersJson from "../../content/badges/subtopicClusters.json"

/* --------------------------------------------------------- family templates */

/** One family generator template (deposit weight, tier scale, glyph/copy). */
export interface FamilyTemplate {
  weight: number
  tierScale: number
  copyKey: string
  glyphFrom: string
}

const FAMILY_TEMPLATES = familiesJson.families as Record<string, FamilyTemplate>

/** The geometric cumulative tier ladder (Bronze, Silver, Gold, Platinum). */
export const TIER_LADDER: readonly [number, number, number, number] =
  familiesJson.tierLadder as [number, number, number, number]

/* ------------------------------------------------------------ skill families */

interface SkillFamilyDef {
  copyKey: string
  glyph: string
  tools: string[]
}
const SKILL_FAMILIES = skillFamiliesJson.families as Record<string, SkillFamilyDef>

/** Build the toolId → skill-family-id[] map (a tool may join two families). */
function buildToolFamilyMap(): Map<string, string[]> {
  const m = new Map<string, string[]>()
  for (const [famId, def] of Object.entries(SKILL_FAMILIES)) {
    for (const tool of def.tools) {
      const cur = m.get(tool) ?? []
      cur.push(famId)
      m.set(tool, cur)
    }
  }
  return m
}
const TOOL_FAMILY_MAP = buildToolFamilyMap()

/** The skill families a toolId maps into (may be 1–2). Empty if unknown. */
export function skillFamiliesForTool(toolId: string): string[] {
  return TOOL_FAMILY_MAP.get(toolId) ?? []
}

/** All skill-family ids (vocab, listening, …) in declaration order. */
export const SKILL_FAMILY_IDS: string[] = Object.keys(SKILL_FAMILIES)

/* -------------------------------------------------------------- clusters (G) */

export interface SubtopicCluster {
  clusterId: string
  domain: string
  copyKey: string
  entryIds: number[]
}
const CLUSTERS = (subtopicClustersJson.clusters as SubtopicCluster[]).slice()

/** Clusters indexed by the corpus entry_ids they cover (for router routing). */
function buildClusterByEntry(): Map<number, SubtopicCluster[]> {
  const m = new Map<number, SubtopicCluster[]>()
  for (const c of CLUSTERS) {
    for (const id of c.entryIds) {
      const cur = m.get(id) ?? []
      cur.push(c)
      m.set(id, cur)
    }
  }
  return m
}
const CLUSTER_BY_ENTRY = buildClusterByEntry()

/** The subtopic clusters whose entryIds overlap the drilled rows. */
export function clustersForEntryIds(entryIds: number[] | undefined): SubtopicCluster[] {
  if (!entryIds || entryIds.length === 0) return []
  const seen = new Set<string>()
  const out: SubtopicCluster[] = []
  for (const id of entryIds) {
    for (const c of CLUSTER_BY_ENTRY.get(id) ?? []) {
      if (!seen.has(c.clusterId)) {
        seen.add(c.clusterId)
        out.push(c)
      }
    }
  }
  return out
}

/* ------------------------------------------------------------ the 13 domains */

/** The canonical 13 domains (domains.json). Coverage clamps which actually emit. */
export const ALL_DOMAINS: string[] = [
  "everyday", "travel", "business", "health", "education", "social", "housing",
  "environment", "emergency", "civic", "numbers", "technology", "culture",
]

/** The 6 CEFR levels. */
export const ALL_LEVELS: string[] = ["A1", "A2", "B1", "B2", "C1", "C2"]

/* ----------------------------------------------------------- id construction */

/** Build the stable, facet-derived badge id. STABLE — regen yields identical ids. */
export function badgeIdFor(family: BadgeFamily, ...facets: string[]): string {
  return [family, ...facets].join(":")
}

/* --------------------------------------------------------- the coverage spec */

/**
 * The per-language coverage matrix the generator clamps to. B1's
 * `gen_badge_catalog.py` reads this from `release.sqlite3`; B0 hand-supplies the
 * trimmed ES coverage. `domainLevels[domain]` = the CEFR levels with corpus rows.
 */
export interface CoverageMatrix {
  /** target language code (e.g. "es"). */
  target: string
  /** domain → the CEFR levels that actually have corpus rows. */
  domainLevels: Record<string, string[]>
  /** the tool ids the corpus/scene actually exercises (for family H). */
  tools: string[]
  /** cluster ids in scope (default: all clusters whose domain is covered). */
  clusterIds?: string[]
  /**
   * Optional family allow-list. B0 ships a CURATED subset (A·C·E·G·H — no F long
   * tail) so the trimmed set is ~40, not the full fan-out; B1 omits this to emit
   * the full A–H taxonomy (~1000). The ROUTER is unaffected — it skips any badge
   * the catalog doesn't contain, so credits silently fold into the present families.
   */
  families?: BadgeFamily[]
}

/* --------------------------------------------------------- the B0 ES coverage */

/**
 * The TRIMMED B0 ES coverage — the shipping Antigua content (Greetings, Café,
 * Market, Travel, Numbers) across the core skills. Curated to families A·C·E·G·H
 * (per BADGES_PROGRESSION Phase B0: "families A+C+E + a few G clusters") so the
 * realized set is a tasteful ~40, generated by the SAME generator B1 uses at full
 * coverage (no separate code path — B0 just narrows domains/levels/families).
 */
export const B0_ES_COVERAGE: CoverageMatrix = {
  target: "es",
  domainLevels: {
    social: ["A1", "A2"],
    everyday: ["A1", "A2"],
    travel: ["A1", "A2", "B1"],
    numbers: ["A1"],
  },
  tools: ["word-scramble", "fast-translate", "listen-choose", "build-sentence", "read-aloud"],
  families: ["A", "C", "E", "G", "H"],
}

/* ------------------------------------------------------------- the generator */

function tpl(family: BadgeFamily): FamilyTemplate {
  return FAMILY_TEMPLATES[family]
}

function mkBadge(
  family: BadgeFamily,
  id: string,
  glyph: string,
  facets: Partial<Pick<Badge, "domain" | "toolId" | "level" | "clusterId" | "entryIds">>,
): Badge {
  const t = tpl(family)
  return {
    id,
    family,
    copyKey: t.copyKey,
    glyph,
    tierScale: t.tierScale,
    ...facets,
  }
}

/**
 * Generate the full catalog from a coverage matrix — the ONE code path for both
 * the B0 trimmed set and the B1 ~1000 fan-out. Clamps every family to coverage
 * (a domain with no C2 rows produces no C2 badge there), so the realized count
 * self-trims to what the corpus supports.
 */
export function generateCatalog(cov: CoverageMatrix): Badge[] {
  const out: Badge[] = []
  const domains = Object.keys(cov.domainLevels)
  const skills = SKILL_FAMILY_IDS
  const allow = cov.families ? new Set<BadgeFamily>(cov.families) : null
  const on = (f: BadgeFamily) => !allow || allow.has(f)

  // A — Domain mastery (one per covered domain).
  if (on("A"))
    for (const d of domains) {
      out.push(mkBadge("A", badgeIdFor("A", d), d, { domain: d }))
    }
  // B — Domain × CEFR (clamp to covered levels).
  if (on("B"))
    for (const d of domains) {
      for (const lvl of cov.domainLevels[d]) {
        out.push(mkBadge("B", badgeIdFor("B", d, lvl), d, { domain: d, level: lvl }))
      }
    }
  // C — Skill mastery (one per skill family).
  if (on("C"))
    for (const s of skills) {
      out.push(mkBadge("C", badgeIdFor("C", s), SKILL_FAMILIES[s].glyph, {}))
    }
  // D — Skill × CEFR (skills × the union of covered levels).
  if (on("D")) {
    const coveredLevels = unionLevels(cov)
    for (const s of skills) {
      for (const lvl of coveredLevels) {
        out.push(mkBadge("D", badgeIdFor("D", s, lvl), SKILL_FAMILIES[s].glyph, { level: lvl }))
      }
    }
  }
  // E — Domain × Skill.
  if (on("E"))
    for (const d of domains) {
      for (const s of skills) {
        out.push(mkBadge("E", badgeIdFor("E", d, s), d, { domain: d }))
      }
    }
  // F — Domain × Skill × CEFR (the long tail; clamp to the domain's levels).
  if (on("F"))
    for (const d of domains) {
      for (const s of skills) {
        for (const lvl of cov.domainLevels[d]) {
          out.push(mkBadge("F", badgeIdFor("F", d, s, lvl), d, { domain: d, level: lvl }))
        }
      }
    }
  // G — Subtopic clusters (only clusters whose domain is covered).
  if (on("G")) {
    const clusterIds = cov.clusterIds ? new Set(cov.clusterIds) : null
    for (const c of CLUSTERS) {
      if (!cov.domainLevels[c.domain]) continue
      if (clusterIds && !clusterIds.has(c.clusterId)) continue
      out.push(
        mkBadge("G", badgeIdFor("G", c.domain, c.clusterId), c.clusterId, {
          domain: c.domain,
          clusterId: c.clusterId,
          entryIds: c.entryIds.slice(),
        }),
      )
    }
  }
  // H — Tool virtuoso (one per exercised tool).
  if (on("H"))
    for (const tool of cov.tools) {
      out.push(mkBadge("H", badgeIdFor("H", tool), tool, { toolId: tool as ChallengeToolId }))
    }

  return out
}

function unionLevels(cov: CoverageMatrix): string[] {
  const set = new Set<string>()
  for (const levels of Object.values(cov.domainLevels)) for (const l of levels) set.add(l)
  return ALL_LEVELS.filter((l) => set.has(l))
}

/* ------------------------------------------------------------- BadgeCatalog */

/** The indexed catalog the router + store + UI consume. */
export interface BadgeCatalog {
  target: string
  all: Badge[]
  byId: Map<string, Badge>
  get(id: string): Badge | undefined
}

/** Index a generated badge list into a lookup catalog. */
export function indexCatalog(target: string, badges: Badge[]): BadgeCatalog {
  const byId = new Map<string, Badge>()
  for (const b of badges) byId.set(b.id, b)
  return { target, all: badges, byId, get: (id) => byId.get(id) }
}

/**
 * Build the catalog for a target language. B0: feed `B0_ES_COVERAGE` for the
 * trimmed ES set. B1: feed the real `CoverageMatrix` from the corpus → ~1000.
 */
export function buildCatalog(cov: CoverageMatrix): BadgeCatalog {
  return indexCatalog(cov.target, generateCatalog(cov))
}

/** Convenience: the B0 shipping ES catalog. */
export function buildEsB0Catalog(): BadgeCatalog {
  return buildCatalog(B0_ES_COVERAGE)
}

/** The deposit weight + tierScale for a family (router curve inputs). */
export function familyWeight(family: BadgeFamily): number {
  return tpl(family).weight
}
