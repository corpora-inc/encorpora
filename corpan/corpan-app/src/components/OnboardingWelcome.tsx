// src/components/onboarding/OnboardingWelcome.tsx

import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { isRTL } from "@/util/convert";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";

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
    const { i18n } = useTranslation();
    const uiRTL = i18n.dir() === "rtl";
    const NextArrow = uiRTL ? ArrowLeftCircle : ArrowRightCircle;
    const [shadowColor, setShadowColor] = useState(HIGHLIGHT_COLORS[0]);
    const [idx, setIdx] = useState(0);
    const [fading, setFading] = useState(false);

    // Memoize welcomes array for perf (won't change during onboarding).
    // Deduplicate by visible word so identical greetings (e.g. Velkommen for
    // both no/da, Selamat datang for id/ms) only appear once. Canonical
    // WELCOME_BY_LANG mappings are unchanged — the dedupe is render-time only.
    const welcomes = useMemo(
        () => {
            const all = ALL_LANGUAGES.map((code) => ({
                code,
                word: TRANSLATIONS.getWelcomeLabel(code),
            }));
            const seen = new Set<string>();
            return all.filter((w) => {
                const key = w.word.trim();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
        },
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
    const dir = isRTL(current.code) ? "rtl" : "ltr";

    // Auto-shrink the language cloud + welcome word so all 38 entries + button
    // always fit, even with large user text size. Measures the column's
    // overflow against the parent and scales the cloud down (and trims the
    // word size) to fit. Layout is otherwise unchanged from the original
    // centered-cloud design.
    const rootRef = useRef<HTMLDivElement>(null);
    const cloudRef = useRef<HTMLDivElement>(null);
    const [cloudScale, setCloudScale] = useState(1);

    useLayoutEffect(() => {
        const root = rootRef.current;
        const cloud = cloudRef.current;
        if (!root || !cloud) return;

        const fit = () => {
            cloud.style.transform = "scale(1)";
            requestAnimationFrame(() => {
                // Compare the column's natural height against the visible
                // viewport from where the column starts. Parent containers
                // are content-sized in the wizard shell, so use viewport.
                const top = root.getBoundingClientRect().top;
                const avail = Math.max(window.innerHeight - top, 0);
                const natural = root.scrollHeight;
                if (avail <= 0 || natural <= 0 || natural <= avail) {
                    setCloudScale(1);
                    return;
                }
                const overflow = natural - avail;
                const cloudH = cloud.scrollHeight;
                if (cloudH <= 0) return;
                const nextCloud = Math.max(0, cloudH - overflow);
                setCloudScale(Math.max(0.45, Math.min(1, nextCloud / cloudH)));
            });
        };

        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(root);
        window.addEventListener("resize", fit);
        return () => {
            ro.disconnect();
            window.removeEventListener("resize", fit);
        };
    }, [welcomes.length]);

    return (
        <div
            ref={rootRef}
            // Fixed-inset full-viewport so this screen centers regardless of
            // what the parent WizardShell does (it is now a pass-through —
            // each onboarding step owns its own layout). Centering is from
            // the inner flexbox below; the fixed wrapper just hosts it.
            className="fixed inset-0 flex flex-col items-center justify-center px-6 gap-y-5 bg-background md:bg-muted"
            style={{
                overflow: "hidden",
                paddingTop: "env(safe-area-inset-top)",
                paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)",
                paddingLeft: "max(env(safe-area-inset-left), 1.5rem)",
                paddingRight: "max(env(safe-area-inset-right), 1.5rem)",
            }}
        >
            {/* Animated welcome word */}
            <div
                className="flex flex-col items-center justify-center w-full"
                style={{
                    maxWidth: 600,
                    minHeight: 80,
                    position: "relative",
                }}
            >
                <span
                    className="absolute w-full text-center pointer-events-none font-bold"
                    style={{
                        // px-based so user text-size doesn't affect onboarding
                        // vh cap also prevents very tall words on short viewports
                        fontSize: "min(clamp(34px, 7vw, 64px), 10vh)",
                        color: "var(--foreground)",
                        opacity: fading ? 0 : 1,
                        transition: `opacity ${FADE_DURATION}ms`,
                        letterSpacing: 1,
                        lineHeight: 1.4,
                        textShadow: `0 2px 24px ${shadowColor}88, 0 0px 2px #3336`,
                        willChange: "opacity",
                    }}
                    lang={current.code}
                    dir={dir}
                >
                    {current.word}
                </span>
            </div>

            {/* Inline faded welcomes — auto-scaled to fit if needed */}
            <div
                ref={cloudRef}
                className="flex flex-wrap gap-2 justify-center items-center"
                style={{
                    maxWidth: "min(680px, 92vw)",
                    transform: `scale(${cloudScale})`,
                    transformOrigin: "center center",
                    transition: "transform 200ms ease-out",
                }}
            >
                {welcomes.map((w, i) => {
                    const isActive = i === idx;
                    return (
                        <span
                            key={w.code}
                            style={{
                                margin: "0 0.15em",
                                // px-based so user text-size doesn't affect onboarding
                                fontSize: "clamp(11px, 2.6vw, 22px)",
                                lineHeight: 1.5,
                                opacity: isActive ? (fading ? 0.2 : 1) : 0.35,
                                fontWeight: 500,
                                color: isActive ? "var(--foreground)" : "var(--muted-foreground)",
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
                <NextArrow size={36} className="text-white" />
            </button>
        </div>
    );
}
