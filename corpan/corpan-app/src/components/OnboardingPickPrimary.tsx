import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { ArrowRightCircle } from "lucide-react";

export function OnboardingPickPrimary() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const setLanguages = useSettingsStore(s => s.setLanguages);

    const handleSelect = (code: string) => {
        setLanguages([code]);
        setStep(2);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white overflow-y-auto p-1">
            <div
                className="w-full max-w-xl flex flex-col gap-4 items-center justify-center px-2"
                style={{
                    // height: "min(80vh, 620px)", // fits nicely on all screens, but doesn't overflow on desktop
                    // overflowY: "auto",
                    paddingTop: 32,
                    paddingBottom: 32,
                }}
            >
                {ALL_LANGUAGES.map((code) => {
                    const label =
                        TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.["make primary language"] ||
                        TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.[code as keyof typeof TRANSLATIONS["en"]] ||
                        code;

                    return (
                        <button
                            key={code}
                            onClick={() => handleSelect(code)}
                            lang={code}
                            className={`
                                w-full px-5 py-4
                                rounded-2xl shadow
                                bg-white border border-gray-200
                                text-lg font-semibold text-gray-900
                                flex items-center justify-between
                                focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                                hover:bg-gray-50 hover:border-purple-400
                                transition
                                text-left
                                break-words
                                select-text
                            `}
                            style={{
                                minHeight: 56,
                                wordBreak: "break-word",
                                whiteSpace: "normal",
                                lineHeight: 1.25,
                            }}
                        >
                            <span className="flex-1">{label}</span>
                            <ArrowRightCircle className="ml-4 shrink-0 text-gray-400" size={22} />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
