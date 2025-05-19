// OnboardingPickPrimary.tsx
import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { ArrowRightCircle } from "lucide-react";
import { ScrollIndicatorWrapper } from "./ScrollIndicatorWrapper";

export function OnboardingPickPrimary() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const setLanguages = useSettingsStore(s => s.setLanguages);

    const handleSelect = (code: string) => {
        setLanguages([code]);
        setStep(2);
    };

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full w-full mb-4">
            <ScrollIndicatorWrapper className="flex-1 min-h-0 flex flex-col justify-center">
                <div
                    className="w-full max-w-xl flex flex-col gap-2 items-center mx-auto"
                    style={{ padding: 24 }}
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
            </ScrollIndicatorWrapper>
        </div>
    );
}
