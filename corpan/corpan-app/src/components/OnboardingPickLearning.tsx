import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { ArrowRightCircle, ArrowLeftCircle, CheckCircle2 } from "lucide-react";
import { useEffect, useRef } from "react";

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

    const containerRef = useRef<HTMLDivElement>(null);
    const onboardingStep = useSettingsStore(s => s.onboardingStep);

    useEffect(() => {
        // console.log("Onboarding step changed:", onboardingStep, "scrolling to top");
        // console.log(containerRef.current);
        if (containerRef.current) {
            // console.log("FML");
            const curr = containerRef.current;
            setTimeout(() => {
                curr.scrollTo({ top: -1000, behavior: "smooth" });
            }, 30);
        }
    }, [onboardingStep]); // Or pass nothing if you want to scroll on mount


    return (
        <div
            ref={containerRef}
            className="flex flex-col items-center justify-center min-h-screen w-full bg-white overflow-y-auto p-1"
        >
            <div
                className="w-full max-w-xl flex flex-col gap-4 items-center justify-center px-2"
                style={{
                    paddingTop: 32,
                    paddingBottom: 32,
                }}
            >
                {/* Header row with Back and Next */}
                <div className="w-full flex flex-row items-center justify-between mb-4">
                    <button
                        className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition"
                        onClick={() => setStep(1)}
                        // aria-label={t("Back")}
                        tabIndex={0}
                    >
                        <ArrowLeftCircle size={30} />
                    </button>
                    <div
                        className="flex-1 text-center text-2xl font-semibold text-gray-800 select-none"
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
                        // aria-label={t("Continue")}
                        disabled={!canProceed}
                        tabIndex={0}
                    >
                        <ArrowRightCircle size={30} />
                    </button>
                </div>
                {/* Language Options */}
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
                            }}
                            dir={dir()}
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
            </div>
        </div>
    );
}
