import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft } from "lucide-react";

// OnboardingPickPrimary: Step 1 of wizard
export function OnboardingPickPrimary() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const languages = useSettingsStore(s => s.languages);
    const setLanguages = useSettingsStore(s => s.setLanguages);

    // For display: which is currently selected as primary?
    const primary = languages[0] || null;

    // Use the language's own translation for its name (if available)
    const getLangLabel = (code: string) =>
        TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.[code as keyof typeof TRANSLATIONS["en"]] || code;

    // Handler: Set this language as the new primary, keeping other selections after it
    function handlePrimarySelect(code: string) {
        // Remove if already selected, otherwise move to front
        if (primary === code) return;
        // Filter out code, add to front
        const rest = languages.filter(l => l !== code);
        setLanguages([code, ...rest]);
    }

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white">
            {/* Nav Row */}
            <div className="flex items-center w-full mb-8">
                <button
                    aria-label="Back"
                    className="mr-auto p-3 rounded-full hover:bg-gray-100"
                    onClick={() => setStep(0)}
                >
                    <ChevronLeft size={32} />
                </button>
                <div className="flex-1" />
                <div className="ml-auto w-12" />
            </div>

            {/* Language Picker */}
            <div className="flex flex-wrap gap-3 justify-center mb-8 max-w-2xl">
                {ALL_LANGUAGES.map((code) => (
                    <Button
                        key={code}
                        variant={primary === code ? "default" : "outline"}
                        className="px-4 py-2 rounded-full"
                        onClick={() => handlePrimarySelect(code)}
                    >
                        {getLangLabel(code)}
                    </Button>
                ))}
            </div>

            {/* Next button */}
            <button
                aria-label="Next"
                disabled={!primary}
                onClick={() => setStep(2)}
                className={`
                    bg-black hover:bg-gray-900 text-white rounded-full
                    p-5 shadow-lg flex items-center justify-center transition
                    disabled:opacity-30 disabled:cursor-not-allowed
                `}
            >
                <ChevronRight size={40} />
            </button>
        </div>
    );
}
