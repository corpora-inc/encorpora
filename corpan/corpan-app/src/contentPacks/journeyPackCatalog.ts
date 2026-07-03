// src/contentPacks/journeyPackCatalog.ts
//
// Dedicated JOURNEY COURSE-PACK catalog (course-pack.md §7.1). Journey packs
// are data-only SQLite content packs, one per TARGET language — they are NOT
// in the main app catalog (`catalog-v3.json`) and never appear on Home. They
// live on their own CloudFront index and are discovered from the Journey
// surface / onboarding journey nodes.
//
// Structural clone of `wordPackCatalog.ts` — same resilient fetch layer
// (`catalogFetch.ts`), same localization primitives (`localized.ts`), same
// channel/minAppVersion gating shape — with two deliberate differences:
//   1. keyed by a single `targetLang` (L1 overlays live INSIDE the pack, D6),
//   2. a `schemaVersion` compatibility gate so an old app never sees (let
//      alone downloads) a course DB it cannot read (course-pack.md §8).

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
 *  AND coordinate with `dja/journey_pack/publish_journey_pack.py`. */
export const JOURNEY_PACK_CATALOG_FORMAT_VERSION = 1;

/** Course-DB schema versions this app build can read (course-pack.md §8).
 *  Additive column changes do NOT bump this; breaking DDL does. */
export const SUPPORTED_JOURNEY_SCHEMA_VERSIONS = new Set([1]);

/** Default canonical URL. Build-time overridable via
 *  `VITE_JOURNEY_PACK_CATALOG_URL` for staging / fork builds. */
export const DEFAULT_JOURNEY_PACK_CATALOG_URL =
    "https://d38iwc9748jekz.cloudfront.net/corpan/journey-packs/index.json";

export type JourneyPackChannel = "stable" | "preview";

export type JourneyPackCatalogEntry = {
    /** Underscore-canonical, immutable: "journey_en". */
    id: string;
    /** Discriminator; entries with any other kind are dropped by the parser. */
    kind: "journey-course";
    /** The language this course TEACHES. One course per target (D6). */
    targetLang: string;
    name: string;
    nameLocalized?: LocalizedString;
    description?: string;
    descriptionLocalized?: LocalizedString;
    /** Content semver (== manifest.version == pack_meta.content_version). */
    version: string;
    /** Course-DB schema version; gated against SUPPORTED_JOURNEY_SCHEMA_VERSIONS. */
    schemaVersion: number;
    zipUrl: string;
    sha256?: string;
    sizeMb: number;
    unitCount?: number;
    itemCount?: number;
    /** Highest CEFR arc shipped, e.g. "A1" for v0.1. Display only. */
    arcMax?: string;
    minAppVersion?: string;
    channel?: JourneyPackChannel;
};

export type JourneyPackCatalog = {
    version: number;
    generatedAt: string;
    packs: JourneyPackCatalogEntry[];
};

/* -------------------------------------------------------------------------- */
/*  parser                                                                    */
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

function parseChannel(v: unknown): JourneyPackChannel | undefined {
    const s = toStringValue(v);
    return s === "preview" ? "preview" : s === "stable" ? "stable" : undefined;
}

function parseEntry(item: unknown): JourneyPackCatalogEntry | null {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const id = toStringValue(r.id);
    const kind = toStringValue(r.kind);
    const targetLang = toStringValue(r.targetLang);
    const name = toStringValue(r.name);
    const version = toStringValue(r.version);
    const zipUrl = toStringValue(r.zipUrl);
    const sizeMb = toNumber(r.sizeMb);
    const schemaVersion = r.schemaVersion;
    // Hard requirements (spec §7.1): silently drop anything unusable.
    if (kind !== "journey-course") return null;
    if (!id || !targetLang || !version || !zipUrl) return null;
    if (typeof schemaVersion !== "number" || !Number.isInteger(schemaVersion)) {
        return null;
    }
    return {
        id,
        kind: "journey-course",
        targetLang,
        name: name || id,
        nameLocalized: parseLocalizedString(r.nameLocalized),
        description: toOptionalString(r.description),
        descriptionLocalized: parseLocalizedString(r.descriptionLocalized),
        version,
        schemaVersion,
        zipUrl,
        sha256: toOptionalString(r.sha256),
        sizeMb: sizeMb ?? 0,
        unitCount: toNumber(r.unitCount),
        itemCount: toNumber(r.itemCount),
        arcMax: toOptionalString(r.arcMax),
        minAppVersion: toOptionalString(r.minAppVersion),
        channel: parseChannel(r.channel),
    };
}

export function parseJourneyPackCatalog(data: unknown): JourneyPackCatalog | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const r = data as Record<string, unknown>;
    if (r.version !== JOURNEY_PACK_CATALOG_FORMAT_VERSION) return null;
    if (!Array.isArray(r.packs)) return null;
    const packs: JourneyPackCatalogEntry[] = [];
    for (const item of r.packs) {
        const parsed = parseEntry(item);
        if (parsed) packs.push(parsed);
    }
    return {
        version: JOURNEY_PACK_CATALOG_FORMAT_VERSION,
        generatedAt: toStringValue(r.generatedAt) || new Date().toISOString(),
        packs,
    };
}

/* -------------------------------------------------------------------------- */
/*  fetcher                                                                   */
/* -------------------------------------------------------------------------- */

function getCatalogUrl(): string {
    const envUrl = (import.meta as { env?: Record<string, string | undefined> })
        .env?.VITE_JOURNEY_PACK_CATALOG_URL;
    if (typeof envUrl === "string" && envUrl.length > 0) {
        return envUrl;
    }
    return DEFAULT_JOURNEY_PACK_CATALOG_URL;
}

/**
 * Freshness-aware index fetch used by the store. Sends stored validators for
 * conditional revalidation (304 = a 0-byte poll), is timeout-bounded +
 * retried, and throws only after exhausting retries — the caller treats a
 * throw as "keep cache".
 */
export async function fetchJourneyPackCatalogFresh(
    validators?: Validators,
): Promise<FreshnessResult<JourneyPackCatalog>> {
    return fetchJsonFresh<JourneyPackCatalog>(getCatalogUrl(), {
        parse: parseJourneyPackCatalog,
        validators,
    });
}

/** Back-compat wrapper returning the parsed catalog or null on any failure. */
export async function fetchJourneyPackCatalog(): Promise<JourneyPackCatalog | null> {
    try {
        const r = await fetchJourneyPackCatalogFresh();
        return r.status === "ok" ? r.data : null;
    } catch (err) {
        console.warn("[journey-pack catalog] fetch failed:", err);
        return null;
    }
}

/* -------------------------------------------------------------------------- */
/*  client-side filtering                                                     */
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
 *  `minAppVersion`, `channel` (preview hidden from non-dev), and the
 *  `schemaVersion` gate — an incompatible course is filtered out BEFORE any
 *  download can happen (course-pack.md §7.2). */
export function visibleJourneyPacks(
    catalog: JourneyPackCatalog,
    appVersion: string,
    devMode: boolean,
): JourneyPackCatalogEntry[] {
    return catalog.packs.filter((p) => {
        if (
            p.minAppVersion &&
            compareVersions(appVersion, p.minAppVersion) < 0
        ) {
            return false;
        }
        if (!devMode && p.channel === "preview") return false;
        if (!SUPPORTED_JOURNEY_SCHEMA_VERSIONS.has(p.schemaVersion)) {
            return false;
        }
        return true;
    });
}

/** Base language subtag: "pt-BR" → "pt". */
function baseLang(code: string): string {
    return (code || "").split("-")[0];
}

/**
 * Single resolver for both the Journey hero card and Settings: find the
 * course pack that teaches `targetLang` in an (already filtered) list.
 * Exact-code match first, then base-subtag match — a "pt-BR" stack target
 * resolves the "pt-BR" course when one exists, else the "pt" course.
 */
export function findJourneyPackForTarget(
    packs: JourneyPackCatalogEntry[],
    targetLang: string,
): JourneyPackCatalogEntry | undefined {
    const exact = packs.find(
        (p) => p.targetLang.toLowerCase() === targetLang.toLowerCase(),
    );
    if (exact) return exact;
    const base = baseLang(targetLang).toLowerCase();
    return packs.find((p) => baseLang(p.targetLang).toLowerCase() === base);
}
