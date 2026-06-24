// src/contentPacks/wordPackCatalog.ts
//
// Dedicated WORD-PACK catalog. Word-explanation packs ("wordpan") are a NEW
// KIND of artifact: they are NOT in the main app catalog (`catalog-v3.json`)
// and never appear on Home. They live on their own CloudFront index, are
// discovered in Settings / quick-settings, and are JIT-installed from the
// Phrase Flip long-press popover.
//
// This mirrors `phrasePackCatalog.ts` exactly — same resilient fetch layer
// (`catalogFetch.ts`), same localization primitives (`localized.ts`), same
// channel/minAppVersion gating shape — but the wire format is keyed by a
// (nativeLang → targetLang) PAIR rather than a single id, because a word pack
// is "explanations of <targetLang> words written in <nativeLang>".
//
// Index schema (https://.../corpan/word-packs/index.json):
//   { "version":1, "generatedAt":..., "packs":[ {
//       "id":"wordpan_es_en", "kind":"word-explanation",
//       "nativeLang":"es", "targetLang":"en",
//       "name":..., "nameLocalized":{...},
//       "description":..., "descriptionLocalized":{...},
//       "version":"0.1.0", "zipUrl":..., "sha256":...,
//       "sizeMb":3.06, "wordCount":11757, "languageCount":2,
//       "channel":"preview" } ] }

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

// Re-export so call sites that want the localization helpers can import them
// from this module without reaching into `localized.ts` directly.
export { type LocalizedString, resolveLocalized };

/** Current wire-format version of index.json. Bump only on a breaking change
 *  AND coordinate with the publisher that writes the index. */
export const WORD_PACK_CATALOG_FORMAT_VERSION = 1;

/** Default canonical URL. Build-time overridable via
 *  `VITE_WORD_PACK_CATALOG_URL` for staging / fork builds. */
export const DEFAULT_WORD_PACK_CATALOG_URL =
    "https://d38iwc9748jekz.cloudfront.net/corpan/word-packs/index.json";

export type WordPackChannel = "stable" | "preview";

export type WordPackCatalogEntry = {
    /** Stable pack id, underscore-canonical, immutable. e.g.
     *  "wordpan_es_en". Matches `packIdForNative` in `util/wordPack.ts`. */
    id: string;
    /** Discriminator. Always "word-explanation" for this catalog; entries
     *  with any other `kind` are dropped by the parser. */
    kind: "word-explanation";
    /** The language the explanation paragraphs are written IN (the user's
     *  native / preferred reading language). e.g. "es". */
    nativeLang: string;
    /** The language whose WORDS get explained (the side the reader is
     *  learning / decoding). e.g. "en". */
    targetLang: string;
    /** Display name. English / base — REQUIRED. Ultimate fallback when
     *  `nameLocalized` doesn't cover the active locale. */
    name: string;
    /** Per-language overrides for `name`. Optional. */
    nameLocalized?: LocalizedString;
    /** Semver. */
    version: string;
    /** Free-form display blurb. English / base. */
    description?: string;
    /** Per-language overrides for `description`. Optional. */
    descriptionLocalized?: LocalizedString;
    /** Download target on the CDN (S3/CloudFront). */
    zipUrl: string;
    /** SHA-256 of the zip (optional but recommended). */
    sha256?: string;
    /** Compressed download size in MB. Powers the "Install (~N MB)" copy. */
    sizeMb: number;
    /** Number of explained words (informational only). */
    wordCount?: number;
    /** Number of languages the explanations cover (native + en). */
    languageCount?: number;
    /** Minimum app version that can render this pack cleanly. */
    minAppVersion?: string;
    /** `"preview"` packs are hidden from non-dev users. */
    channel?: WordPackChannel;
};

export type WordPackCatalog = {
    /** Wire-format version. Must match `WORD_PACK_CATALOG_FORMAT_VERSION`
     *  for the parser to accept it. */
    version: number;
    /** ISO8601 timestamp from the publisher. */
    generatedAt: string;
    /** Every word pack in the index, in publisher-write order. */
    packs: WordPackCatalogEntry[];
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

function parseChannel(v: unknown): WordPackChannel | undefined {
    const s = toStringValue(v);
    return s === "preview" ? "preview" : s === "stable" ? "stable" : undefined;
}

function parseEntry(item: unknown): WordPackCatalogEntry | null {
    if (!item || typeof item !== "object") return null;
    const r = item as Record<string, unknown>;
    const id = toStringValue(r.id);
    const kind = toStringValue(r.kind);
    const nativeLang = toStringValue(r.nativeLang);
    const targetLang = toStringValue(r.targetLang);
    const name = toStringValue(r.name);
    const version = toStringValue(r.version);
    const zipUrl = toStringValue(r.zipUrl);
    const sizeMb = toNumber(r.sizeMb);
    // Hard requirements: anything missing an id, a pair, a version, or a
    // download target is unusable and silently dropped.
    if (kind !== "word-explanation") return null;
    if (!id || !nativeLang || !targetLang || !version || !zipUrl) return null;
    return {
        id,
        kind: "word-explanation",
        nativeLang,
        targetLang,
        name: name || id,
        nameLocalized: parseLocalizedString(r.nameLocalized),
        version,
        description: toOptionalString(r.description),
        descriptionLocalized: parseLocalizedString(r.descriptionLocalized),
        zipUrl,
        sha256: toOptionalString(r.sha256),
        sizeMb: sizeMb ?? 0,
        wordCount: toNumber(r.wordCount),
        languageCount: toNumber(r.languageCount),
        minAppVersion: toOptionalString(r.minAppVersion),
        channel: parseChannel(r.channel),
    };
}

export function parseWordPackCatalog(data: unknown): WordPackCatalog | null {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    const r = data as Record<string, unknown>;
    if (r.version !== WORD_PACK_CATALOG_FORMAT_VERSION) return null;
    if (!Array.isArray(r.packs)) return null;
    const packs: WordPackCatalogEntry[] = [];
    for (const item of r.packs) {
        const parsed = parseEntry(item);
        if (parsed) packs.push(parsed);
    }
    return {
        version: WORD_PACK_CATALOG_FORMAT_VERSION,
        generatedAt: toStringValue(r.generatedAt) || new Date().toISOString(),
        packs,
    };
}

/* -------------------------------------------------------------------------- */
/*  fetcher                                                                   */
/* -------------------------------------------------------------------------- */

function getCatalogUrl(): string {
    const envUrl = (import.meta as { env?: Record<string, string | undefined> })
        .env?.VITE_WORD_PACK_CATALOG_URL;
    if (typeof envUrl === "string" && envUrl.length > 0) {
        return envUrl;
    }
    return DEFAULT_WORD_PACK_CATALOG_URL;
}

/**
 * Freshness-aware word-pack index fetch used by the store. Sends stored
 * validators for conditional revalidation (304 = a 0-byte poll), is
 * timeout-bounded + retried, and throws only after exhausting retries — the
 * store treats a throw as "keep cache".
 */
export async function fetchWordPackCatalogFresh(
    validators?: Validators,
): Promise<FreshnessResult<WordPackCatalog>> {
    return fetchJsonFresh<WordPackCatalog>(getCatalogUrl(), {
        parse: parseWordPackCatalog,
        validators,
    });
}

/**
 * Back-compat wrapper returning the parsed catalog or null on any failure.
 */
export async function fetchWordPackCatalog(): Promise<WordPackCatalog | null> {
    try {
        const r = await fetchWordPackCatalogFresh();
        return r.status === "ok" ? r.data : null;
    } catch (err) {
        console.warn("[word-pack catalog] fetch failed:", err);
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
 *  Honors `minAppVersion` and `channel` (preview hidden from non-dev). Word
 *  packs are SQLite-data-only so there's no platform / OS-version gating. */
export function visibleWordPacks(
    catalog: WordPackCatalog,
    appVersion: string,
    devMode: boolean,
): WordPackCatalogEntry[] {
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

/**
 * Normalize a BCP-47 code to its base language subtag (`es-MX` → `es`). Word
 * packs are keyed by base language on both sides of the pair.
 */
function baseLang(code: string): string {
    return (code || "").split("-")[0];
}

/**
 * Find the word pack that explains `targetLang` words in `nativeLang`, if one
 * exists in the (already app/channel-filtered) list. Matches on base language
 * subtags so `es-MX` native still resolves the `es` pack.
 *
 * This is the single source of truth used by BOTH discovery surfaces:
 *  - Settings lists every entry whose `nativeLang` matches the user's native;
 *  - the Phrase Flip JIT popover resolves the exact (native→target) entry to
 *    get its S3 `zipUrl` for install.
 */
export function findWordPackForPair(
    packs: WordPackCatalogEntry[],
    nativeLang: string,
    targetLang: string,
): WordPackCatalogEntry | undefined {
    const n = baseLang(nativeLang);
    const t = baseLang(targetLang);
    return packs.find(
        (p) => baseLang(p.nativeLang) === n && baseLang(p.targetLang) === t,
    );
}
