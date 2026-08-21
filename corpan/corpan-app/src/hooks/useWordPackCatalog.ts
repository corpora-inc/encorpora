// src/hooks/useWordPackCatalog.ts
//
// Projects the live WORD-PACK index (S3-hosted, polled by
// `useWordPackCatalogStore`) into the shapes consumed by the Settings /
// quick-settings discovery section and the Phrase Flip JIT install path.
//
// Mirrors `usePhrasePackCatalog`, but word packs are keyed by a
// (nativeLang → targetLang) PAIR. The view pre-resolves `name` /
// `description` to the active UI language and pre-filters to the packs whose
// `nativeLang` matches the user's primary language, so the Settings list shows
// exactly the packs that are useful to this reader.

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import {
    findWordPackForPair,
    resolveLocalized,
    visibleWordPacks,
    type WordPackCatalogEntry,
} from "@/contentPacks/wordPackCatalog";
import { useCatalogStore } from "@/store/catalog";
import { useSettingsStore } from "@/store/settings";
import { useWordPackCatalogStore } from "@/store/wordPackCatalog";

/** Render-shape for a word pack: the raw entry with `name` / `description`
 *  pre-resolved to the active UI language. */
export type LocalizedWordPack = WordPackCatalogEntry;

export type WordPackCatalogView = {
    /** Every word pack visible to this client (app-version + channel gates
     *  applied), localized to the active UI language. Order preserved. */
    allWordPacks: LocalizedWordPack[];
    /** The subset of `allWordPacks` whose `nativeLang` matches the user's
     *  primary (native) language — i.e. packs that explain words in a
     *  language this reader can actually read. This is what Settings lists. */
    nativeWordPacks: LocalizedWordPack[];
    /** Resolve the exact (native→target) pack, or undefined. Used by the
     *  Phrase Flip JIT popover to get the S3 `zipUrl` to install. */
    findForPair: (
        nativeLang: string,
        targetLang: string,
    ) => LocalizedWordPack | undefined;
    /** O(1) lookup by pack id (limited to visible word packs). */
    byId: (id: string) => LocalizedWordPack | undefined;
};

const EMPTY_VIEW: WordPackCatalogView = {
    allWordPacks: [],
    nativeWordPacks: [],
    findForPair: () => undefined,
    byId: () => undefined,
};

function localizePack(
    p: WordPackCatalogEntry,
    lang: string,
): LocalizedWordPack {
    const description =
        p.description || p.descriptionLocalized
            ? resolveLocalized(p.descriptionLocalized, p.description ?? "", lang)
            : undefined;
    return {
        ...p,
        name: resolveLocalized(p.nameLocalized, p.name, lang),
        description,
    };
}

function baseLang(code: string): string {
    return (code || "").split("-")[0];
}

export function useWordPackCatalog(): WordPackCatalogView {
    const catalog = useWordPackCatalogStore((s) => s.catalog);
    // App version + dev mode live on the v3-catalog store — same running app,
    // so we borrow them rather than duplicate state (same pattern as
    // `usePhrasePackCatalog`).
    const appVersion = useCatalogStore((s) => s.appVersion);
    const { i18n } = useTranslation();
    const lang = i18n.language;
    // languages[0] (store order) is the user's native / primary language.
    const nativeLang = useSettingsStore((s) => s.languages[0] ?? "en");

    return useMemo<WordPackCatalogView>(() => {
        if (!catalog) return EMPTY_VIEW;

        // The word packs ship as channel:"preview" but are PUBLISHED FOR USE —
        // the Journey inline offer and the Phrase Flip long-press both install
        // them for ordinary (non-dev) users, and Settings must list them as the
        // "manage / re-add" surface. So bypass the preview CHANNEL gate here
        // (pass `true`) while still honoring the minAppVersion gate.
        const rawVisible = appVersion
            ? visibleWordPacks(catalog, appVersion, true)
            : // No app version yet (rare; pre-getAppVersion) — show everything.
              catalog.packs;

        const allWordPacks = rawVisible.map((p) => localizePack(p, lang));

        const indexById = new Map<string, LocalizedWordPack>();
        for (const p of allWordPacks) indexById.set(p.id, p);

        const n = baseLang(nativeLang);
        const nativeWordPacks = allWordPacks.filter(
            (p) => baseLang(p.nativeLang) === n,
        );

        return {
            allWordPacks,
            nativeWordPacks,
            findForPair: (nat, tgt) =>
                findWordPackForPair(allWordPacks, nat, tgt),
            byId: (id) => indexById.get(id),
        };
    }, [catalog, appVersion, lang, nativeLang]);
}
