// src/contentPacks/phrasePackCatalog.ts
//
// Dedicated phrase-pack catalog. Lives at a CloudFront URL that the
// publisher rewrites directly via `tools/phrase-packs/publish.py
// --update-catalog`. No PR, no GitHub Actions, no app rebuild — running
// apps refresh within ~5 minutes (TTL) or immediately if the publisher
// runs `--invalidate`.
//
// This file is the wire-format gatekeeper: anything not parsed here is
// invisible to the rest of the app. The PHRASE_PACK_AUTHORING.md doc and
// publish.py both reference the same format constants.

import { type PurchaseInfo } from "./catalog";

/** Current wire-format version of catalog.json. Bump only on a breaking
 *  change AND coordinate with `publish.py :: CATALOG_FORMAT_VERSION`. */
export const PHRASE_PACK_CATALOG_FORMAT_VERSION = 1;

/** Default canonical URL. Built-time overridable via
 *  `VITE_PHRASE_PACK_CATALOG_URL` for staging / fork builds. */
export const DEFAULT_PHRASE_PACK_CATALOG_URL =
    "https://d38iwc9748jekz.cloudfront.net/corpan/phrase-packs/catalog.json";

export type PhrasePackChannel = "stable" | "preview";

export type PhrasePackCatalogEntry = {
    /** Stable pack id, kebab-case, immutable. e.g. "phrase-botany-basics". */
    id: string;
    /** Display name from `pack_meta.name`. */
    name: string;
    /** Semver. */
    version: string;
    /** Free-form display blurb. */
    description?: string;
    /** Authored topic (e.g. "Botany"). */
    topic?: string;
    /** Authored category (e.g. "science"). */
    category?: string;
    /** Download target on the CDN. */
    zipUrl: string;
    /** SHA-256 of the zip (optional but recommended). */
    sha256?: string;
    /** Compressed download size in MB. Powers "Install all (~N MB)" copy. */
    sizeMb: number;
    /** Number of English entries in the pack. */
    entryCount?: number;
    /** Number of target languages the pack ships translations for. */
    languageCount?: number;
    /** CEFR level range, e.g. "A1" / "C2". */
    levelMin?: string;
    levelMax?: string;
    /** Free / one-time IAP / subscription gating. */
    purchase?: PurchaseInfo;
    /** Free-form badges (renderer-defined semantics). */
    tags?: string[];
    /** Minimum app version that can render this pack cleanly. */
    minAppVersion?: string;
    /** `"preview"` packs are hidden from non-dev users. */
    channel?: PhrasePackChannel;
    /** Optional cover image (catalog-side polish). */
    iconUrl?: string;
    /** Optional accent color for the pack picker. */
    accentColor?: string;
};

export type PhrasePackGroup = {
    /** Stable group id, e.g. "starter", "sciences". */
    id: string;
    /** Display label. */
    label: string;
    /** Optional one-liner shown under the group header. */
    description?: string;
    /** Ordered pack ids; entries not in the catalog are silently dropped. */
    packIds: string[];
};

export type PhrasePackCatalog = {
    /** Wire-format version. Must match `PHRASE_PACK_CATALOG_FORMAT_VERSION`
     *  for the parser to accept it. */
    version: number;
    /** ISO8601 timestamp from the publisher. */
    generatedAt: string;
    /** Every pack in the catalog, in publisher-write order. */
    packs: PhrasePackCatalogEntry[];
    /** Catalog-driven starter list for the onboarding picker. */
    onboardingStarterPackIds?: string[];
    /** Catalog-driven group structure for the Packs-tab browser. */
    phrasePackGroups?: PhrasePackGroup[];
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

function parseStringArray(v: unknown): string[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const out = v.filter(
        (s): s is string => typeof s === "string" && s.length > 0,
    );
    return out.length ? out : undefined;
}

function parsePurchase(v: unknown): PurchaseInfo | undefined {
    if (!v || typeof v !== "object") return undefined;
    const r = v as Record<string, unknown>;
    const type = toStringValue(r.type);
    if (type !== "free" && type !== "iap" && type !== "code") return undefined;
    return {
        type,
        productId: toOptionalString(r.productId),
        priceLabel: toOptionalString(r.priceLabel),
        platformPackId: toOptionalString(r.platformPackId),
    };
}

function parseChannel(v: unknown): PhrasePackChannel | undefined {
    const s = toStringValue(v);
    return s === "preview" ? "preview" : s === "stable" ? "stable" : undefined;
}

function parseEntry(item: unknown): PhrasePackCatalogEntry | null {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const id = toStringValue(r.id);
    const name = toStringValue(r.name);
    const version = toStringValue(r.version);
    const zipUrl = toStringValue(r.zipUrl);
    const sizeMb = toNumber(r.sizeMb);
    if (!id || !version || !zipUrl) return null;
    return {
        id,
        name: name || id,
        version,
        description: toOptionalString(r.description),
        topic: toOptionalString(r.topic),
        category: toOptionalString(r.category),
        zipUrl,
        sha256: toOptionalString(r.sha256),
        sizeMb: sizeMb ?? 0,
        entryCount: toNumber(r.entryCount),
        languageCount: toNumber(r.languageCount),
        levelMin: toOptionalString(r.levelMin),
        levelMax: toOptionalString(r.levelMax),
        purchase: parsePurchase(r.purchase),
        tags: parseStringArray(r.tags),
        minAppVersion: toOptionalString(r.minAppVersion),
        channel: parseChannel(r.channel),
        iconUrl: toOptionalString(r.iconUrl),
        accentColor: toOptionalString(r.accentColor),
    };
}

function parseGroups(v: unknown): PhrasePackGroup[] | undefined {
    if (!Array.isArray(v)) return undefined;
    const out: PhrasePackGroup[] = [];
    for (const item of v) {
        if (!item || typeof item !== "object") continue;
        const r = item as Record<string, unknown>;
        const id = toStringValue(r.id);
        const label = toStringValue(r.label);
        const packIds = parseStringArray(r.packIds);
        if (!id || !label || !packIds) continue;
        out.push({
            id,
            label,
            description: toOptionalString(r.description),
            packIds,
        });
    }
    return out.length ? out : undefined;
}

export function parsePhrasePackCatalog(
    data: unknown,
): PhrasePackCatalog | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const r = data as Record<string, unknown>;
    if (r.version !== PHRASE_PACK_CATALOG_FORMAT_VERSION) return null;
    if (!Array.isArray(r.packs)) return null;
    const packs: PhrasePackCatalogEntry[] = [];
    for (const item of r.packs) {
        const parsed = parseEntry(item);
        if (parsed) packs.push(parsed);
    }
    return {
        version: PHRASE_PACK_CATALOG_FORMAT_VERSION,
        generatedAt:
            toStringValue(r.generatedAt) || new Date().toISOString(),
        packs,
        onboardingStarterPackIds: parseStringArray(r.onboardingStarterPackIds),
        phrasePackGroups: parseGroups(r.phrasePackGroups),
    };
}

/* -------------------------------------------------------------------------- */
/*  fetcher                                                                   */
/* -------------------------------------------------------------------------- */

function getCatalogUrl(): string {
    const envUrl = (import.meta as { env?: Record<string, string | undefined> })
        .env?.VITE_PHRASE_PACK_CATALOG_URL;
    if (typeof envUrl === "string" && envUrl.length > 0) {
        return envUrl;
    }
    return DEFAULT_PHRASE_PACK_CATALOG_URL;
}

export async function fetchPhrasePackCatalog(): Promise<PhrasePackCatalog | null> {
    const url = getCatalogUrl();
    try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) {
            console.warn(
                "[phrase-pack catalog] fetch returned non-OK:",
                res.status,
                url,
            );
            return null;
        }
        const data = (await res.json()) as unknown;
        return parsePhrasePackCatalog(data);
    } catch (err) {
        console.warn("[phrase-pack catalog] fetch failed:", err);
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

/** Filter a parsed catalog down to entries the current app/host can show.
 *  Currently honors `minAppVersion` and `channel`; phrase packs are text-
 *  only so we skip platform / OS-version gating. */
export function visiblePhrasePacks(
    catalog: PhrasePackCatalog,
    appVersion: string,
    devMode: boolean,
): PhrasePackCatalogEntry[] {
    return catalog.packs.filter((p) => {
        if (p.minAppVersion && compareVersions(appVersion, p.minAppVersion) < 0) {
            return false;
        }
        if (!devMode && p.channel === "preview") return false;
        return true;
    });
}
