import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { ArrowRightCircle, CheckCircle2 } from "lucide-react";

export function OnboardingPickLearning() {
    // Get all helpers from store
    const setStep = useSettingsStore(s => s.setOnboardingStep);
    const languages = useSettingsStore(s => s.languages);
    const setLanguages = useSettingsStore(s => s.setLanguages);
    const t = useSettingsStore(s => s.t);
    const dir = useSettingsStore(s => s.dir);

    const primary = languages[0];
    const learning = languages.slice(1);

    // Choices: all except primary
    const choices = ALL_LANGUAGES.filter(code => code !== primary);

    // Selection toggling (add/remove from learning languages)
    const toggleLearning = (code: string) => {
        let selected = learning.includes(code)
            ? learning.filter(c => c !== code)
            : [...learning, code];
        setLanguages([primary, ...selected]);
    };

    const canProceed = learning.length > 0;

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white overflow-y-auto p-1">
            <div
                className="w-full max-w-xl flex flex-col gap-4 items-center justify-center px-2"
                style={{
                    paddingTop: 32,
                    paddingBottom: 32,
                    position: "relative"
                }}
            >
                {/* Proceed Arrow (top right, absolute, only shows when something selected) */}
                {canProceed && (
                    <button
                        className="absolute right-0 -top-4 bg-black hover:bg-gray-900 text-white rounded-full p-4 shadow-lg transition"
                        // aria-label={t("Continue")}
                        onClick={() => setStep(3)}
                        tabIndex={0}
                    >
                        <ArrowRightCircle size={32} />
                    </button>
                )}
                {/* Localized CTA */}
                <div
                    className="w-full text-center mb-1 text-2xl font-semibold text-gray-800 select-none"
                    style={{ letterSpacing: 0.5 }}
                    dir={dir()}
                >
                    {t("Pick the languages you want to learn")}
                </div>
                {/* Language Options */}
                {choices.map((code) => {
                    // Prefer label in UI lang, fallback to self-name, fallback to code
                    const label =
                        t(code as any) ||
                        code;
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
