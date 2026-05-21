// src/contentPacks/localized.ts
//
// Shared localization primitives for pack catalogs (phrase packs, game
// packs, reader packs, app packs). Pulled out of `phrasePackCatalog.ts`
// so non-phrase pack code (`catalog.ts`) can import without dragging in
// the phrase-pack-specific schema and without creating a circular import.

/** BCP-47 language code → localized string. See `resolveLocalized` for
 *  the fallback chain. Publisher partials are fine: any locale not
 *  covered falls through to the bare-string base field at the entry's
 *  top level (which stays English / required). */
export type LocalizedString = Record<string, string>;

/** Parse a `{ "en": "...", "es": "..." }` map. Permissive: drops
 *  non-string entries silently, returns `undefined` for empty result so
 *  the catalog entry's optional `*Localized?` field stays unset. */
export function parseLocalizedString(
    v: unknown,
): LocalizedString | undefined {
    if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
    const r = v as Record<string, unknown>;
    const out: LocalizedString = {};
    for (const [key, value] of Object.entries(r)) {
        if (
            typeof key === "string" &&
            typeof value === "string" &&
            value.length > 0
        ) {
            out[key] = value;
        }
    }
    return Object.keys(out).length ? out : undefined;
}

/** Pick the best localized variant of a string for the given UI
 *  language, falling back gracefully when a locale is missing.
 *
 *  Resolution order:
 *    1. Exact match (`pt-BR`).
 *    2. Base language (`pt-BR` → `pt`).
 *    3. Script-sibling hops for the Chinese family — handles publishers
 *       who ship only one of {Hans, Hant} and Cantonese-Hant users.
 *    4. English (`en`) entry inside the map.
 *    5. The bare-string `fallback` (already required, English at the
 *       entry top level).
 *
 *  Always returns a non-empty string when `fallback` is non-empty.
 */
export function resolveLocalized(
    map: LocalizedString | undefined,
    fallback: string,
    lang: string,
): string {
    if (!map) return fallback;

    // 1. Exact match.
    const exact = map[lang];
    if (typeof exact === "string" && exact.length > 0) return exact;

    // 2. Base language (locale minus region/script suffix).
    const dashIdx = lang.indexOf("-");
    if (dashIdx > 0) {
        const base = lang.slice(0, dashIdx);
        const baseHit = map[base];
        if (typeof baseHit === "string" && baseHit.length > 0) return baseHit;
    }

    // 3. Script-sibling hops, Chinese family only.
    if (lang.startsWith("zh") || lang.startsWith("yue")) {
        const ZH_SIBLINGS = ["zh-Hans", "zh-Hant", "zh"];
        for (const sib of ZH_SIBLINGS) {
            if (sib === lang) continue;
            const hit = map[sib];
            if (typeof hit === "string" && hit.length > 0) return hit;
        }
    }

    // 4. English fallback inside the map.
    const en = map["en"];
    if (typeof en === "string" && en.length > 0) return en;

    // 5. The bare-string fallback (catalog entry's top-level field).
    return fallback;
}

/** Resolve a pack's `name` and `description` against the active UI
 *  language. Returns a copy with the localized strings inlined onto the
 *  bare-string fields — the `*Localized` maps are preserved on the
 *  result so downstream consumers can re-resolve if they need to.
 *
 *  The shape constraint is loose by design: works for `CatalogGame`,
 *  `CatalogV3Entry`, `PhrasePackCatalogEntry`, `InstalledPhrasePack`,
 *  or any in-house display struct that adopts the same `*Localized`
 *  convention. */
export function localizePack<
    T extends {
        name: string;
        description?: string;
        nameLocalized?: LocalizedString;
        descriptionLocalized?: LocalizedString;
    },
>(pack: T, lang: string): T {
    return {
        ...pack,
        name: resolveLocalized(pack.nameLocalized, pack.name, lang),
        ...(pack.description !== undefined || pack.descriptionLocalized
            ? {
                description: resolveLocalized(
                    pack.descriptionLocalized,
                    pack.description ?? "",
                    lang,
                ),
            }
            : {}),
    };
}
