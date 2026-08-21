// src/components/packs/WordPackSection.tsx
//
// Word-pack discovery, rendered inside SettingsModal. Word-explanation packs
// ("wordpan") are a NEW KIND of artifact: they are NOT in the main catalog
// (catalog-v3.json) and never appear on Home. They are discovered HERE (and via
// the Phrase Flip long-press popover) and downloaded from a dedicated S3 index
// (`contentPacks/wordPackCatalog.ts`).
//
// This lists the packs whose explanation language matches the user's native
// (primary) language — i.e. packs that let them long-press a word in Phrase
// Flip and read what it means in a language they can read. Install reuses the
// same `installWordPack(packId, zipUrl)` plumbing as the popover, sourcing the
// zipUrl from the S3 index.

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useWordPackCatalog } from "@/hooks/useWordPackCatalog";
import { LANGUAGE_NAMES } from "@/store/constants";
import { installWordPack, isWordPackInstalled } from "@/util/wordPack";

type RowState =
    | { kind: "checking" }
    | { kind: "installed" }
    | { kind: "available" }
    | { kind: "installing" }
    | { kind: "failed" };

function WordPackRow({
    id,
    name,
    description,
    targetLang,
    sizeMb,
    zipUrl,
}: {
    id: string;
    name: string;
    description?: string;
    targetLang: string;
    sizeMb: number;
    zipUrl: string;
}) {
    const { t } = useTranslation();
    const [state, setState] = useState<RowState>({ kind: "checking" });

    // The catalog entry is explicit about which language's WORDS this pack
    // explains (`targetLang`) vs. which language the explanations are
    // WRITTEN IN (`nativeLang`, already reflected in `name`/`description`).
    // Today every shipped pack targets English, but that's a catalog fact,
    // not something to assume here — read it from metadata so a future DE
    // (or other) explanation pack labels itself correctly with no code
    // change. Prefer the fully-localized language name (translated into the
    // active UI language) and fall back to `LANGUAGE_NAMES`'s English name
    // if a translation is ever missing.
    const explainedLanguage = t(`languages.${targetLang}`, {
        defaultValue: LANGUAGE_NAMES[targetLang] ?? targetLang,
    });

    useEffect(() => {
        let alive = true;
        void (async () => {
            const installed = await isWordPackInstalled(id);
            if (alive) setState({ kind: installed ? "installed" : "available" });
        })();
        return () => {
            alive = false;
        };
    }, [id]);

    const sizeLabel = sizeMb > 0 ? `≈${sizeMb.toFixed(1)} MB` : "";

    const doInstall = useCallback(async () => {
        setState({ kind: "installing" });
        try {
            await installWordPack(id, zipUrl);
        } catch {
            setState({ kind: "failed" });
            return;
        }
        setState({ kind: "installed" });
    }, [id, zipUrl]);

    return (
        <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
            <BookText className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{name}</div>
                <div className="truncate text-xs text-muted-foreground">
                    {t("wordPacks.explains", {
                        defaultValue: "{{language}} words",
                        language: explainedLanguage,
                    })}
                </div>
                {description ? (
                    <div className="truncate text-xs text-muted-foreground">
                        {description}
                    </div>
                ) : null}
            </div>
            <div className="shrink-0">
                {state.kind === "installed" ? (
                    <span className="text-xs font-medium text-muted-foreground">
                        {t("wordPacks.installed", { defaultValue: "Installed" })}
                    </span>
                ) : state.kind === "installing" ? (
                    <span className="text-xs text-muted-foreground">
                        {t("wordPacks.installing", { defaultValue: "Installing…" })}
                    </span>
                ) : state.kind === "checking" ? (
                    <span className="text-xs text-muted-foreground">…</span>
                ) : (
                    <Button
                        size="sm"
                        variant={state.kind === "failed" ? "destructive" : "default"}
                        onClick={() => void doInstall()}
                    >
                        {state.kind === "failed"
                            ? t("wordPacks.retry", { defaultValue: "Try again" })
                            : t("wordPacks.install", {
                                  defaultValue: "Install ({{size}})",
                                  size: sizeLabel,
                              })}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function WordPackSection() {
    const { t } = useTranslation();
    const { nativeWordPacks } = useWordPackCatalog();

    // Nothing to discover for this native language — render nothing so the
    // settings page stays uncluttered for the (current) majority of users.
    if (nativeWordPacks.length === 0) return null;

    return (
        <div className="space-y-2">
            <h3 className="text-sm font-semibold">
                {t("wordPacks.header", { defaultValue: "Word explanations" })}
            </h3>
            <p className="text-xs text-muted-foreground">
                {t("wordPacks.intro", {
                    defaultValue:
                        "Install a pack to long-press any word in Phrase Flip and read what it means in your language.",
                })}
            </p>
            <div className="space-y-2">
                {nativeWordPacks.map((p) => (
                    <WordPackRow
                        key={p.id}
                        id={p.id}
                        name={p.name}
                        description={p.description}
                        targetLang={p.targetLang}
                        sizeMb={p.sizeMb}
                        zipUrl={p.zipUrl}
                    />
                ))}
            </div>
        </div>
    );
}
