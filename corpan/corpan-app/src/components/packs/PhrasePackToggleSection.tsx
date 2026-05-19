// src/components/packs/PhrasePackToggleSection.tsx
//
// Per-stack phrase-pack toggle UI, rendered inside SettingsModal's Stacks
// tab right after DomainPicker. Lists the user's *installed* packs (not
// the full catalog — that lives in the Packs tab) with per-stack on/off
// switches, plus the bundled-corpus toggle.
//
// Stays phone-friendly because the row count is bounded by what the user
// has actually downloaded (~5–30 in practice, not 1000).

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Database, Library } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import {
    usePhrasePacksStore,
    type InstalledPhrasePack,
} from "@/store/phrasePacks";

// Mirror of the bundled corpus's actual row count (cor_entry). Updating
// the bundled corpus eventually wants a source-of-truth constant; for
// now this matches `dja/release.sqlite3`.
const BASE_CORPUS_ENTRY_COUNT = 10_000;

type Props = {
    /** Called when the user taps "Browse all packs →". Owner switches the
     *  modal's active tab to "packs" and (ideally) scrolls to the phrase-
     *  pack section. */
    onOpenCatalog?: () => void;
};

export function PhrasePackToggleSection({ onOpenCatalog }: Props) {
    const { t } = useTranslation();
    const baseCorpusEnabled = useSettingsStore((s) => s.baseCorpusEnabled);
    const setBaseCorpusEnabled = useSettingsStore((s) => s.setBaseCorpusEnabled);
    const phrasePackIds = useSettingsStore((s) => s.phrasePackIds);
    const togglePhrasePack = useSettingsStore((s) => s.togglePhrasePack);

    const installed = usePhrasePacksStore((s) => s.installed);
    const packs = useMemo(
        () =>
            Object.values(installed).sort((a, b) =>
                a.name.localeCompare(b.name),
            ),
        [installed],
    );
    const phrasesLabel = (n: number) =>
        t("packs.phrasePack.entryCount", {
            defaultValue: "{{n}} phrases",
            n,
        });

    // Count chip: total active sources (base + active packs) over total
    // possible sources (base + installed packs).
    const totalSources = packs.length + 1;
    const activePacksCount = packs.filter((p) =>
        phrasePackIds.includes(p.id),
    ).length;
    const activeSources = (baseCorpusEnabled ? 1 : 0) + activePacksCount;

    return (
        <section
            className="w-full mt-3"
            aria-labelledby="phrase-packs-toggle-header"
        >
            <header className="mb-2 flex items-center justify-between">
                <h3
                    id="phrase-packs-toggle-header"
                    className="font-semibold text-sm flex items-center gap-1.5"
                >
                    <Library size={14} className="text-muted-foreground/80" />
                    {t("settings.phrasePacks.header", {
                        defaultValue: "Phrase packs",
                    })}
                </h3>
                <span className="text-[11px] tabular-nums text-muted-foreground">
                    {/* Pure numbers — no translation needed. */}
                    {activeSources}/{totalSources}
                </span>
            </header>

            <ul className="flex flex-col gap-1.5 list-none p-0 m-0">
                {/* Base corpus row — always first, always present.
                    Disable the base toggle when it's the only thing keeping
                    sources non-empty: zero active sources = the main loop
                    has nothing to sample. The user can disable base only
                    while at least one phrase pack is active. */}
                <ToggleRow
                    icon={<Database size={14} aria-hidden="true" />}
                    name={t("settings.phrasePacks.baseCorpusName", {
                        defaultValue: "Base corpus",
                    })}
                    subtitle={phrasesLabel(BASE_CORPUS_ENTRY_COUNT)}
                    on={baseCorpusEnabled}
                    onToggle={() => setBaseCorpusEnabled(!baseCorpusEnabled)}
                    disabled={baseCorpusEnabled && activePacksCount === 0}
                />
                {/* Installed phrase packs. A pack toggle is locked off when
                    turning it off would zero out the sources (base is off
                    and this is the only active pack). */}
                {packs.map((pack) => {
                    const isActive = phrasePackIds.includes(pack.id);
                    const isLastActive =
                        isActive && !baseCorpusEnabled && activePacksCount === 1;
                    return (
                        <ToggleRow
                            key={pack.id}
                            icon={<BookOpen size={14} aria-hidden="true" />}
                            name={pack.name}
                            subtitle={formatPackSubtitle(pack, phrasesLabel)}
                            on={isActive}
                            onToggle={() => togglePhrasePack(pack.id)}
                            disabled={isLastActive}
                        />
                    );
                })}
            </ul>

            {/* Empty-state hint when no packs installed. */}
            {packs.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground/80 leading-snug">
                    {t("settings.phrasePacks.emptyHint", {
                        defaultValue: "Add packs from the Packs tab.",
                    })}
                </p>
            )}

            {/* Browse-all CTA */}
            {onOpenCatalog && (
                <Button
                    type="button"
                    variant="outline"
                    onClick={onOpenCatalog}
                    className="mt-3 w-full justify-center gap-2"
                >
                    {t("settings.phrasePacks.browseAll", {
                        defaultValue: "Browse packs",
                    })}
                    <ArrowRight size={14} />
                </Button>
            )}
        </section>
    );
}

function formatPackSubtitle(
    pack: InstalledPhrasePack,
    phrasesLabel: (n: number) => string,
): string {
    const parts: string[] = [];
    if (pack.entryCount > 0) parts.push(phrasesLabel(pack.entryCount));
    const level =
        pack.levelMin && pack.levelMax
            ? pack.levelMin === pack.levelMax
                ? pack.levelMin
                : `${pack.levelMin}–${pack.levelMax}`
            : null;
    if (level) parts.push(level);
    return parts.join(" · ");
}

function ToggleRow({
    icon,
    name,
    subtitle,
    on,
    onToggle,
    disabled = false,
}: {
    icon: React.ReactNode;
    name: string;
    subtitle?: string;
    on: boolean;
    onToggle: () => void;
    /** When true, the user can't flip this toggle. We use it to lock the
     *  last active source on — the main loop has nothing to sample if
     *  everything is off. */
    disabled?: boolean;
}) {
    return (
        <li>
            <div
                className={[
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-md",
                    "border bg-card",
                    "transition-colors",
                    on ? "border-purple-400/40" : "border-border",
                    disabled ? "opacity-90" : "",
                ].join(" ")}
            >
                <span className="shrink-0 text-muted-foreground">{icon}</span>
                <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground leading-tight truncate">
                        {name}
                    </div>
                    {subtitle && (
                        <div className="text-[11px] text-muted-foreground truncate">
                            {subtitle}
                        </div>
                    )}
                </div>
                <Switch
                    checked={on}
                    onCheckedChange={onToggle}
                    disabled={disabled}
                />
            </div>
        </li>
    );
}
