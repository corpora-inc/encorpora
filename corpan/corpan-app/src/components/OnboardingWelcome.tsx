// src/components/onboarding/OnboardingWelcome.tsx

import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { RTL_LANGUAGES } from "@/store/constants";
import { ArrowRightCircle } from "lucide-react";
import { useEffect, useState, useMemo } from "react";

const DISPLAY_DURATION = 2200; // ms before fade starts
const FADE_DURATION = 2000; // ms fade in/out

const HIGHLIGHT_COLORS = [
    "#ac6df6", // purple
    "#ff7edb", // pink
    "#6df6c1", // teal
    "#f6d96d", // gold
    "#f66d6d", // coral
];

function getRandomColor() {
    return HIGHLIGHT_COLORS[Math.floor(Math.random() * HIGHLIGHT_COLORS.length)];
}

export function OnboardingWelcome() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const [shadowColor, setShadowColor] = useState(HIGHLIGHT_COLORS[0]);
    const [idx, setIdx] = useState(0);
    const [fading, setFading] = useState(false);

    // Memoize welcomes array for perf (won't change during onboarding)
    const welcomes = useMemo(
        () =>
            ALL_LANGUAGES.map((code) => ({
                code,
                word: TRANSLATIONS.getWelcomeLabel(code),
            })),
        []
    );

    useEffect(() => {
        let fadeTimeout: ReturnType<typeof setTimeout>;
        let nextTimeout: ReturnType<typeof setTimeout>;

        fadeTimeout = setTimeout(() => setFading(true), DISPLAY_DURATION);

        nextTimeout = setTimeout(() => {
            setIdx((i) => (i + 1) % welcomes.length);
            setFading(false);
        }, DISPLAY_DURATION + FADE_DURATION);

        return () => {
            clearTimeout(fadeTimeout);
            clearTimeout(nextTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, welcomes.length]);

    useEffect(() => {
        setShadowColor(getRandomColor());
    }, [idx]);

    const current = welcomes[idx];
    const baseLang = current.code.split("-")[0];
    const dir = RTL_LANGUAGES.includes(baseLang) ? "rtl" : "ltr";

    return (
        <div
            className="flex flex-col flex-1 w-full h-full items-center justify-center px-6 pb-6 gap-y-7
            md:max-h-[730px] md:justify-center"
            style={{ minHeight: 0 }}
        >
            {/* Animated welcome word */}
            <div
                className="flex flex-col items-center justify-center w-full"
                style={{
                    maxWidth: 600,
                    minHeight: 60,
                    position: "relative",
                }}
            >
                <span
                    className="absolute w-full text-center pointer-events-none font-bold"
                    style={{
                        fontSize: "clamp(2.1rem, 7vw, 3.2rem)",
                        color: "#222",
                        opacity: fading ? 0 : 1,
                        transition: `opacity ${FADE_DURATION}ms`,
                        letterSpacing: 1,
                        textShadow: `0 2px 24px ${shadowColor}88, 0 0px 2px #3336`,
                        willChange: "opacity",
                    }}
                    lang={current.code}
                    dir={dir}
                >
                    {current.word}
                </span>
            </div>

            {/* Inline faded welcomes */}
            <div
                className="flex flex-wrap gap-3 justify-center items-center"
                style={{ maxWidth: 600 }}
            >
                {welcomes.map((w, i) => {
                    const isActive = i === idx;
                    return (
                        <span
                            key={w.code}
                            className="text-lg font-medium"
                            style={{
                                margin: "0 0.2em",
                                opacity: isActive ? (fading ? 0.2 : 1) : 0.35,
                                fontWeight: 500,
                                color: isActive ? "#222" : "#999",
                                textShadow: isActive
                                    ? fading
                                        ? "0 2px 24px #fff0, 0 0px 2px #3330"
                                        : `0 2px 24px ${shadowColor}88, 0 0px 2px #3339`
                                    : "none",
                                letterSpacing: 0.5,
                                transition: `opacity ${FADE_DURATION}ms, color ${FADE_DURATION}ms, text-shadow ${FADE_DURATION}ms`,
                                filter: isActive ? "brightness(1.12)" : "none",
                            }}
                            lang={w.code}
                        >
                            {w.word}
                        </span>
                    );
                })}
            </div>

            {/* Center button */}
            <button
                aria-label="Next"
                className="
          flex items-center justify-center
          bg-black hover:bg-gray-900
          border border-purple-400
          rounded-md
          transition
          outline-none ring-0 z-10
          shadow-2xl
          text-3xl
          hover:cursor-pointer
        "
                style={{
                    boxShadow: "0 8px 64px 0 #0002",
                    width: 72,
                    height: 72,
                    borderWidth: 1,
                    borderStyle: "solid",
                }}
                onClick={() => setStep(1)}
            >
                <ArrowRightCircle size={36} className="text-white" />
            </button>
        </div>
    );
}
