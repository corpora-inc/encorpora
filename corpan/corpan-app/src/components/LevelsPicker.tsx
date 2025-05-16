import { useSettingsStore, ALL_LEVELS } from "@/store/settings";
import { Button } from "@/components/ui/button";

export function LevelsPicker() {
    const levels = useSettingsStore((s) => s.levels);
    const setLevels = useSettingsStore((s) => s.setLevels);

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
        <div className="w-full mt-6">
            <div className="mb-2 font-semibold text-sm">Levels</div>
            <div className="flex gap-2 mb-3">
                <Button
                    size="sm"
                    variant={allActive ? "default" : "outline"}
                    onClick={handleSelectAll}
                >
                    Select all
                </Button>
            </div>
            <div className="flex flex-wrap gap-2">
                {ALL_LEVELS.map((code) => {
                    const selected = allActive || levels.includes(code);
                    return (
                        <Button
                            key={code}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            size="sm"
                            className={`
                                rounded-full text-xs p-3
                                transition
                                ${selected ? "shadow-sm" : ""}
                            `}
                            aria-pressed={selected}
                            onClick={() => toggleLevel(code)}
                        >
                            {code}
                        </Button>
                    );
                })}
            </div>
            <div className="mt-2 text-xs text-gray-400">
                {allActive
                    ? "All levels included."
                    : levels.length === 0
                        ? "No levels selected (all will be included)."
                        : `${levels.length} selected.`}
            </div>
        </div>
    );
}
