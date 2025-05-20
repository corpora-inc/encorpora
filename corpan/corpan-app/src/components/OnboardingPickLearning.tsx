import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { ArrowRightCircle, ArrowLeftCircle, CheckCircle2 } from "lucide-react";
import { ScrollIndicatorWrapper } from "./ScrollIndicatorWrapper";

export function OnboardingPickLearning() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const languages = useSettingsStore(s => s.languages);
    const setLanguages = useSettingsStore(s => s.setLanguages);
    const t = useSettingsStore(s => s.t);
    const dir = useSettingsStore(s => s.dir);

    const primary = languages[0];
    const learning = languages.slice(1);
    const choices = ALL_LANGUAGES.filter(code => code !== primary);

    const toggleLearning = (code: string) => {
        let selected = learning.includes(code)
            ? learning.filter(c => c !== code)
            : [...learning, code];
        setLanguages([primary, ...selected]);
    };

    const canProceed = learning.length > 0;

    return (
        <div className="flex flex-col h-full w-full">
            {/* Header always on top */}
            <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2">
                <button
                    className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition"
                    onClick={() => setStep(1)}
                    tabIndex={0}
                >
                    <ArrowLeftCircle size={30} />
                </button>
                <div
                    className="flex-1 text-center text-lg font-semibold text-gray-800 select-none px-2"
                    style={{ letterSpacing: 0.5 }}
                    dir={dir()}
                >
                    {t("Pick the languages you want to learn")}
                </div>
                <button
                    className={`flex items-center justify-center rounded-full p-3 shadow transition
                        ${canProceed
                            ? "bg-black hover:bg-gray-900 text-white"
                            : "bg-gray-200 text-gray-400 cursor-not-allowed"
                        }`}
                    onClick={() => canProceed && setStep(3)}
                    disabled={!canProceed}
                    tabIndex={0}
                >
                    <ArrowRightCircle size={30} />
                </button>
            </div>
            {/* Scrollable list with scroll indicators */}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center"
            >
                <ScrollIndicatorWrapper
                    className="w-full max-w-xl flex flex-col gap-2 items-center px-2 pb-4 mx-auto"

                >
                    {choices.map((code) => {
                        const label = t(code as any) || code;
                        const selected = learning.includes(code);
                        return (
                            <button
                                key={code}
                                onClick={() => toggleLearning(code)}
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
                                    ${selected ? "border-purple-500 bg-purple-50" : ""}
                                `}
                                style={{
                                    minHeight: 56,
                                    wordBreak: "break-word",
                                    whiteSpace: "normal",
                                    lineHeight: 1.25,
                                    // margin: "0 auto",
                                }}
                            >
                                <span className="flex-1">{label}</span>
                                {selected ? (
                                    <CheckCircle2 className="ml-4 shrink-0 text-purple-500" size={24} />
                                ) : (
                                    <span className="ml-4 shrink-0 w-6 h-6" />
                                )}
                            </button>
                        );
                    })}
                </ScrollIndicatorWrapper>
            </div>
        </div>
    );
}
