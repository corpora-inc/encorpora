/**
 * Badge i18n composition (BADGES_PROGRESSION §6.4). A badge's DISPLAY NAME is
 * COMPOSED from parts — `family.F` = "{domain} · {skill} — {level}" — each part
 * localized through the injected `Translate` seam. Badges carry only a `copyKey`
 * (the family pattern) + facets; the name is assembled here so all ~1000 badges
 * need zero per-badge strings: only the ~140 part strings localize per language.
 *
 * The `Translate` seam is injected (stub `(key)=>key` until LOCALES land); we
 * back it with the bundled `en.json` as the per-key English fallback so the
 * Badge Case is never blank even with the bare stub.
 */

import type { Badge } from "@corpan-city/contracts"
import type { Translate } from "../contracts/runtime"
import enStrings from "../../content/badges/strings/en.json"
import { skillFamiliesForTool } from "./catalog"

const EN = enStrings as Record<string, string>

/** Fill `{placeholders}` in a template from a params map. */
function interpolate(tpl: string, params: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`))
}

/**
 * Wrap a `Translate` so a missing key falls back to the bundled English string,
 * then to the key itself — never blank. Also applies params (the stub ignores them).
 */
export function createBadgeT(t: Translate, lang: string): (key: string, params?: Record<string, string | number>) => string {
  return (key, params) => {
    let s = t(key, lang, params)
    // The stub returns the key unchanged → fall back to bundled English.
    if (s === key || s == null || s === "") {
      const en = EN[key]
      if (en != null) s = params ? interpolate(en, params) : en
    } else if (params && /\{\w+\}/.test(s)) {
      s = interpolate(s, params)
    }
    return s
  }
}

export type BadgeT = ReturnType<typeof createBadgeT>

/** The localized skill-family name for a badge (its first/primary skill axis). */
function skillNameFor(badge: Badge, bt: BadgeT): string {
  // C/D carry the skill in the id's 2nd segment; E/F derive it from the id too.
  const segs = badge.id.split(":")
  let skillId: string | undefined
  if (badge.family === "C" || badge.family === "D") skillId = segs[1]
  else if (badge.family === "E" || badge.family === "F") skillId = segs[2]
  else if (badge.toolId) skillId = skillFamiliesForTool(badge.toolId)[0]
  return skillId ? bt(`skill.${skillId}`) : ""
}

/** Compose a badge's localized display name from its family pattern + facets. */
export function badgeName(badge: Badge, bt: BadgeT): string {
  const domain = badge.domain ? bt(`domain.${badge.domain}`) : ""
  const level = badge.level ? bt(`level.${badge.level}`) : ""
  const skill = skillNameFor(badge, bt)
  const cluster = badge.clusterId ? bt(`cluster.${badge.clusterId}`) : ""
  const tool = badge.toolId ? bt(`tool.${badge.toolId}`) : ""
  return bt(badge.copyKey, { domain, level, skill, cluster, tool, streak: cluster, quest: cluster, season: cluster })
}

/** A plain-language "how to fill this" line from the badge's facets (§4.4). */
export function howToFill(badge: Badge, bt: BadgeT): string {
  const domain = badge.domain ? bt(`domain.${badge.domain}`) : ""
  const skill = skillNameFor(badge, bt)
  if (badge.family === "G") return badgeName(badge, bt)
  if (badge.family === "H" && badge.toolId) return bt(`tool.${badge.toolId}`)
  if (skill && domain) return `${skill} · ${domain}`
  return skill || domain || badgeName(badge, bt)
}

/** The EN fallback table (exported for the offline stub `Translate`). */
export const BADGE_EN = EN
