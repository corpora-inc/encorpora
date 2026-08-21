import { useSettingsStore, ALL_LEVELS } from "@/store/settings";
import { useTranslation } from "react-i18next";

export function LevelsPicker() {
    const levels = useSettingsStore((s) => s.levels);
    const setLevels = useSettingsStore((s) => s.setLevels);

    const dir = useSettingsStore((s) => s.dir());
    const { t } = useTranslation()

    const allActive = levels.length === 0 || levels.length === ALL_LEVELS.length;

    function toggleLevel(code: string) {
        if (allActive) {
            setLevels([code]);
        } else if (levels.includes(code)) {
            // Remove; if none left, implies "all"
            setLevels(levels.filter((d) => d !== code));
        } else {
            setLevels([...levels, code]);
        }
    }

    function handleSelectAll() {
        setLevels([...ALL_LEVELS]);
    }

    return (
        <div className="w-full mt-1">
            <div className="mb-2 flex items-center justify-between gap-2" dir={dir}>
                <span className="font-semibold text-sm">{t("settings.levels")}</span>
                <button
                    type="button"
                    onClick={handleSelectAll}
                    aria-pressed={allActive}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                        allActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    }`}
                >
                    {t("settings.selectAll")}
                </button>
            </div>
            {/* One non-wrapping, horizontally-scrolling track of CEFR chips —
                never a second row. Multi-select toggles (not a radio group), so
                these stay chips rather than a SegmentedControl. */}
            <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-md border border-border bg-muted/40 p-1" dir={dir}>
                {ALL_LEVELS.map((code) => {
                    const selected = allActive || levels.includes(code);
                    return (
                        <button
                            key={code}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => toggleLevel(code)}
                            className={`flex-1 min-w-[44px] rounded-[6px] px-3 py-2 md:py-2.5 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                                selected
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {code}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-muted-foreground" dir={dir}>
                {allActive
                    ? t("settings.allLevelsIncluded")
                    : `${levels.length} ${t("settings.selected")}.`}
            </div>
        </div>
    );
}
