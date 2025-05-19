import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { RTL_LANGUAGES } from "@/store/constants";
import { ArrowRightCircle } from "lucide-react";
import { useEffect, useState } from "react";

const CYCLE_INTERVAL_MS = 2000; // How fast the center word cycles

export function OnboardingWelcome() {
    const setStep = useSettingsStore(s => s.setOnboardingStep);

    // Build a flat array of {code, word} objects for easier use
    const welcomes = ALL_LANGUAGES.map(code => ({
        code,
        word: TRANSLATIONS[code as keyof typeof TRANSLATIONS]?.["welcome" as keyof typeof TRANSLATIONS["en"]] || code
    }));

    const [idx, setIdx] = useState(0);

    // Cycle through welcomes
    useEffect(() => {
        const timer = setInterval(() => {
            setIdx(i => (i + 1) % welcomes.length);
        }, CYCLE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [welcomes.length]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen w-full bg-white relative p-10 gap-y-8"

        >
            {/* Centered, animated welcome */}
            <div
                className="flex flex-col items-center justify-center"
                // style={{ minHeight: "128px" }}
                style={{ maxWidth: 600 }}
            >
                <span
                    className="text-4xl font-bold text-gray-800 transition-all duration-500 text-center"
                    style={{ letterSpacing: 1 }}
                    lang={welcomes[idx].code}
                    dir={RTL_LANGUAGES.includes(welcomes[idx].code.split('-')[0]) ? "rtl" : "ltr"}
                >
                    {welcomes[idx].word}
                </span>
            </div>
            {/* Small faded welcomes in a line underneath */}
            <div className="flex flex-wrap gap-3 justify-center items-center"
                style={{ maxWidth: 600 }}
            >
                {welcomes.map((w, i) => (
                    <span
                        key={w.code}
                        className={`text-lg font-medium transition-opacity duration-500`}
                        style={{
                            // padding: "0 0.1em",
                            margin: "0 0.2em",
                            opacity: i === idx ? 1 : 0.35,
                            // fontWeight: i === idx ? 700 : 400,
                            fontWeight: 500,
                            textShadow: i === idx
                                ? "0 2px 16px #ac6df688, 0 0px 2px #3339"
                                : undefined,
                            letterSpacing: 0.5,
                            // transitionDuration: "0.5s",

                        }}
                        lang={w.code}
                    >
                        {w.word}
                    </span>
                ))}
            </div>
            {/* Center button */}
            <button
                aria-label="Next"
                className="
                    flex items-center justify-center
                    bg-black hover:bg-gray-900 text-white shadow-2xl
                    rounded-full transition
                    outline-none ring-0 border-none z-10
                    text-3xl
                "
                style={{
                    boxShadow: "0 8px 64px 0 #0003",
                    width: 90, height: 90,
                }}
                onClick={() => setStep(1)}
            >
                <ArrowRightCircle size={40} />
            </button>
        </div>
    );
}
