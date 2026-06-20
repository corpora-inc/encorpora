// src/components/packs/resolveFailedPacks.ts
//
// Pure helper behind the phrase-pack "Download all" retry path.
//
// The "Download all" failed-retry state is tracked by pack ID — not a
// bare count, and NOT scoped to the current filter/category/search view.
// At retry time we resolve those ids back to live pack objects from the
// FULL catalog, dropping any that have since been installed (by another
// install path) or vanished from the catalog. The result is the exact
// set the retry batch acts on; if it's empty the caller clears the stale
// state so the affordance disappears instead of offering a dead tap.

/** Minimal shape we need to resolve + filter a failed pack. */
export interface ResolvablePack {
    id: string;
}

/**
 * Resolve stored failed pack IDs back to live pack objects, independent
 * of any current view. Skips ids that no longer resolve in the catalog
 * and ids that are now installed.
 *
 * @param failedIds   ids captured from the last batch's failures
 * @param byId        catalog lookup (full catalog, not the current view)
 * @param isInstalled predicate — true if the pack is already on device
 */
export function resolveFailedPacks<P extends ResolvablePack>(
    failedIds: readonly string[],
    byId: (id: string) => P | undefined,
    isInstalled: (id: string) => boolean,
): P[] {
    if (failedIds.length === 0) return [];
    const resolved: P[] = [];
    for (const id of failedIds) {
        const pack = byId(id);
        if (pack === undefined) continue; // gone from catalog
        if (isInstalled(pack.id)) continue; // resolved elsewhere
        resolved.push(pack);
    }
    return resolved;
}
