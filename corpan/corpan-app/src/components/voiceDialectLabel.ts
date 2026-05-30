// encorpora/corpan/corpan-app/src/components/voiceDialectLabel.ts
// Shared, translations-first dialect-label resolution for the TTS onboarding.
// Extracted so the confident default view and the power-user grid render the
// SAME human label for a language/region tag (e.g. "Spanish (Mexico)",
// "Chinese (Traditional)") without duplicating the casing/fallback logic.

/** Normalize tag casing & collapse "zh--CN" style artifacts. */
export function normalizeTagCasing(tag: string): string {
    const [base, ...extParts] = tag.split("-u-");
    const parts = base.split("-").filter(Boolean);
    if (!parts.length) return tag;

    const lang = parts[0].toLowerCase();

    let i = 1;
    let script: string | undefined;
    let region: string | undefined;

    if (parts[i] && parts[i].length === 4) {
        const s = parts[i];
        script = s[0].toUpperCase() + s.slice(1).toLowerCase();
        i++;
    }
    if (parts[i] && (parts[i].length === 2 || parts[i].length === 3)) {
        region = parts[i].toUpperCase();
        i++;
    }

    const rest = parts.slice(i);
    const rebuiltParts: string[] = [lang];
    if (script) rebuiltParts.push(script);
    if (region) rebuiltParts.push(region);
    if (rest.length) rebuiltParts.push(...rest);

    const rebuilt = rebuiltParts.join("-");
    return extParts.length ? `${rebuilt}-u-${extParts.join("-u-")}` : rebuilt;
}

export function stripUnicodeExtensions(tag: string): string {
    return tag.replace(/-u-.*/i, "");
}

/**
 * Resolve a human, localized dialect label for a BCP-47 tag using the
 * `dialects.*` i18n namespace, falling back from most-specific to least.
 * `trDial(key)` must return "" when the key is missing.
 */
export function resolveDialectLabel(fullTag: string, trDial: (k: string) => string): string {
    const normFull = normalizeTagCasing(fullTag);
    const base = stripUnicodeExtensions(normFull);

    const v1 = trDial(normFull);
    if (v1) return v1;

    const v2 = trDial(base);
    if (v2) return v2;

    const parts = base.split("-");
    const lang = parts[0];
    const script = parts[1]?.length === 4 ? parts[1] : undefined;
    const region = script ? parts[2] : parts[1];

    if (script) {
        const v3a = trDial(`${lang}-${script}`);
        if (v3a) return v3a;
    }
    if (region) {
        const v3b = trDial(`${lang}-${region}`);
        if (v3b) return v3b;
    }

    const v4 = trDial(lang);
    if (v4) return v4;

    if (base === "zh-Hans") return "Chinese (Simplified)";
    if (base === "zh-Hant") return "Chinese (Traditional)";
    return base;
}
