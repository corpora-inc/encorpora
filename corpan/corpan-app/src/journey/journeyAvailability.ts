// src/journey/journeyAvailability.ts — the shared "is there a course pack for
// this language?" check. Wraps the journey-pack index fetch + the channel-aware
// selection seam (resolveJourneyPackForTarget: stable preferred, preview
// fallback, compat gates respected) so Home hero gating and the onboarding
// guided opt-in ask the exact same question and can never disagree.

import {
  fetchJourneyPackCatalog,
  resolveJourneyPackForTarget,
} from "../contentPacks/journeyPackCatalog"
import { getAppVersion } from "../lib/appVersion"

/**
 * Does an installable course pack (stable OR a preview fallback) teach
 * `targetLang`, published in the journey-pack index and compatible with this
 * app build? Network-bounded and total: resolves `false` on offline / index
 * unreachable / no compatible pack — the caller decides the UX (Home hides the
 * hero; onboarding disables the guided opt-in). Never throws, so it is safe to
 * await optimistically without blocking a flow.
 */
export async function isJourneyPackAvailableForTarget(
  targetLang: string,
): Promise<boolean> {
  try {
    const catalog = await fetchJourneyPackCatalog()
    if (!catalog) return false
    const appVersion = await getAppVersion()
    return !!resolveJourneyPackForTarget(catalog, targetLang, appVersion)
  } catch {
    return false
  }
}
