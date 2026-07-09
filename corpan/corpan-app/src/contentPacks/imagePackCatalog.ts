// src/contentPacks/imagePackCatalog.ts
//
// Dedicated IMAGE-PACK catalog for `imagepan` (research/images.md — the
// language-neutral concept-picture pack). Like the journey-course and word
// packs, imagepan is a data-only SQLite+assets content pack that is NOT in the
// main app catalog (`catalog-v3.json`) and never appears on Home. It lives on
// its own CloudFront index and is auto-installed the first time a Journey
// session opens (see `util/imagePack.ts` + `journey/runtimeWiring.ts`).
//
// Structural clone of `journeyPackCatalog.ts` — same resilient fetch layer
// (`catalogFetch.ts`), same localization primitives, same channel/minAppVersion
// gating — trimmed to what a single language-neutral data pack needs (no
// per-target keying, no schemaVersion DDL gate; the resolver tolerates a
// missing/renamed column by degrading a card, never crashing).
//
// GRACEFUL DEGRADE: every failure mode here (no index, unreachable index,
// entry filtered out by minAppVersion/channel) resolves to "no pack" — the
// caller then never installs imagepan and Journey behavior is exactly as today
// (no picture cards). This is what lets the wiring ship before the pack is
// published.

import {
    fetchJsonFresh,
    type FreshnessResult,
    type Validators,
} from "./catalogFetch";
import {
    type LocalizedString,
    parseLocalizedString,
    resolveLocalized,
} from "./localized";

// Re-export so call sites can import the localization helpers from here.
export { type LocalizedString, resolveLocalized };

/** Current wire-format version of index.json. Bump only on a breaking change
 *  AND coordinate with `corpan/tools/imagepan/publish_image_pack.py`. */
export const IMAGE_PACK_CATALOG_FORMAT_VERSION = 1;

/** Default canonical URL. Build-time overridable via
 *  `VITE_IMAGE_PACK_CATALOG_URL` for staging / fork builds. */
export const DEFAULT_IMAGE_PACK_CATALOG_URL =
    "https://d38iwc9748jekz.cloudfront.net/corpan/imagepan/index.json";

export type ImagePackChannel = "stable" | "preview";

export type ImagePackCatalogEntry = {
    /** Stable pack id, immutable: "imagepan". */
    id: string;
    /** Discriminator; entries with any other kind are dropped by the parser. */
    kind: "image-pack";
    name: string;
    nameLocalized?: LocalizedString;
    description?: string;
    descriptionLocalized?: LocalizedString;
    /** Content semver (== manifest.version == pack_meta.version). */
    version: string;
    zipUrl: string;
    sha256?: string;
    sizeMb: number;
    /** Concept count shipped. Display only. */
    conceptCount?: number;
    minAppVersion?: string;
    channel?: ImagePackChannel;
};

export type ImagePackCatalog = {
    version: number;
    generatedAt: string;
    packs: ImagePackCatalogEntry[];
};

/* -------------------------------------------------------------------------- */
/*  parser                                                                     */
/* -------------------------------------------------------------------------- */

function toStringValue(v: unknown): string {
    return typeof v === "string" ? v : "";
}

function toOptionalString(v: unknown): string | undefined {
    return typeof v === "string" ? v : undefined;
}

function toNumber(v: unknown): number | undefined {
    return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

function parseChannel(v: unknown): ImagePackChannel | undefined {
    const s = toStringValue(v);
    return s === "preview" ? "preview" : s === "stable" ? "stable" : undefined;
}

function parseEntry(item: unknown): ImagePackCatalogEntry | null {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const id = toStringValue(r.id);
    const kind = toStringValue(r.kind);
    const name = toStringValue(r.name);
    const version = toStringValue(r.version);
    const zipUrl = toStringValue(r.zipUrl);
    const sizeMb = toNumber(r.sizeMb);
    // Hard requirements: silently drop anything unusable.
    if (kind !== "image-pack") return null;
    if (!id || !version || !zipUrl) return null;
    return {
        id,
        kind: "image-pack",
        name: name || id,
        nameLocalized: parseLocalizedString(r.nameLocalized),
        description: toOptionalString(r.description),
        descriptionLocalized: parseLocalizedString(r.descriptionLocalized),
        version,
        zipUrl,
        sha256: toOptionalString(r.sha256),
        sizeMb: sizeMb ?? 0,
        conceptCount: toNumber(r.conceptCount),
        minAppVersion: toOptionalString(r.minAppVersion),
        channel: parseChannel(r.channel),
    };
}

export function parseImagePackCatalog(data: unknown): ImagePackCatalog | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const r = data as Record<string, unknown>;
    if (r.version !== IMAGE_PACK_CATALOG_FORMAT_VERSION) return null;
    if (!Array.isArray(r.packs)) return null;
    const packs: ImagePackCatalogEntry[] = [];
    for (const item of r.packs) {
        const parsed = parseEntry(item);
        if (parsed) packs.push(parsed);
    }
    return {
        version: IMAGE_PACK_CATALOG_FORMAT_VERSION,
        generatedAt: toStringValue(r.generatedAt) || new Date().toISOString(),
        packs,
    };
}

/* -------------------------------------------------------------------------- */
/*  fetcher                                                                    */
/* -------------------------------------------------------------------------- */

function getCatalogUrl(): string {
    const envUrl = (import.meta as { env?: Record<string, string | undefined> })
        .env?.VITE_IMAGE_PACK_CATALOG_URL;
    if (typeof envUrl === "string" && envUrl.length > 0) {
        return envUrl;
    }
    return DEFAULT_IMAGE_PACK_CATALOG_URL;
}

/**
 * Freshness-aware index fetch. Sends stored validators for conditional
 * revalidation (304 = a 0-byte poll), is timeout-bounded + retried, and throws
 * only after exhausting retries — the caller treats a throw as "keep cache".
 */
export async function fetchImagePackCatalogFresh(
    validators?: Validators,
): Promise<FreshnessResult<ImagePackCatalog>> {
    return fetchJsonFresh<ImagePackCatalog>(getCatalogUrl(), {
        parse: parseImagePackCatalog,
        validators,
    });
}

/** Back-compat wrapper returning the parsed catalog or null on any failure. */
export async function fetchImagePackCatalog(): Promise<ImagePackCatalog | null> {
    try {
        const r = await fetchImagePackCatalogFresh();
        return r.status === "ok" ? r.data : null;
    } catch (err) {
        console.warn("[image-pack catalog] fetch failed:", err);
        return null;
    }
}

/* -------------------------------------------------------------------------- */
/*  client-side filtering                                                      */
/* -------------------------------------------------------------------------- */

function compareVersions(a: string, b: string): number {
    const norm = (s: string) =>
        s.split(".").map((p) => Number.parseInt(p, 10) || 0);
    const left = norm(a);
    const right = norm(b);
    const len = Math.max(left.length, right.length);
    for (let i = 0; i < len; i += 1) {
        const diff = (left[i] ?? 0) - (right[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/** Filter a parsed catalog down to entries the current app can use. Honors
 *  `minAppVersion` and `channel` (preview hidden from non-dev). */
export function visibleImagePacks(
    catalog: ImagePackCatalog,
    appVersion: string,
    devMode: boolean,
): ImagePackCatalogEntry[] {
    return catalog.packs.filter((p) => {
        if (
            p.minAppVersion &&
            compareVersions(appVersion, p.minAppVersion) < 0
        ) {
            return false;
        }
        if (!devMode && p.channel === "preview") return false;
        return true;
    });
}

/** The canonical imagepan entry from an (already filtered) list, or undefined. */
export function findImagePack(
    packs: ImagePackCatalogEntry[],
    packId = "imagepan",
): ImagePackCatalogEntry | undefined {
    return packs.find((p) => p.id === packId);
}
