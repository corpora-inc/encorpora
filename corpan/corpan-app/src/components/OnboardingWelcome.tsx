// src/components/onboarding/OnboardingWelcome.tsx

import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { isRTL } from "@/util/convert";
import { ArrowLeftCircle, ArrowRightCircle } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import corpanMark from "@/assets/corpan-mark-trim.png";
import type { OnboardingStepProps } from "@/onboarding/types";

const DISPLAY_DURATION = 1800; // ms before fade starts
const FADE_DURATION = 1500; // ms fade in/out  (1800 + 1500 = 3.3s per word)

// All-hearing-ear ghost. A slow, subliminal breath on its OWN rhythm — not
// synced to the words. Polyrhythm: two ear breaths for every three word cycles,
// so the two drift against each other (realigning every ~9.9s) for an organic,
// never-quite-repeating feel. It fully reaches 0 each breath and stays faint,
// so an occasional overlap with a bright word reads as ambient, not competing.
const EAR_BREATH = false; // false = calm static watermark; true = slow polyrhythm breath
// Static watermark opacity is theme-dependent: orange-on-black needs much more
// than orange-on-white to read at the same subliminal presence.
const EAR_STATIC_DARK = 0.095;
const EAR_STATIC_LIGHT = 0.045;
const EAR_PEAK = 0.065; // breath bloom peak
const EAR_FLOOR = 0.012; // breath trough — right at the edge of invisible
const WORD_CYCLE = DISPLAY_DURATION + FADE_DURATION; // 3300ms
const EAR_CYCLE = Math.round((WORD_CYCLE * 3) / 2); // 4950ms — 2 breaths : 3 words

// Brand tagline under the wordmark. Kept OFF for sparse minimalism; flip to
// true to A/B test "Pure Learning" on the Welcome screen. English by design —
// Welcome precedes language selection, and the tagline is a brand signature,
// not localizable UI copy.
const SHOW_TAGLINE = true; // ships ON ("Pure Learning" under the wordmark); flip false for the sparse A/B variant
const TAGLINE = "Pure Learning";

// Single brand purple for the word glow — the same family as the Next button's
// border. The old random gold/coral/teal/pink palette clashed with the orange
// all-hearing-ear watermark; one consistent purple reads as intentional.
const HIGHLIGHT = "#ac6df6";

export function OnboardingWelcome({ onAdvance }: OnboardingStepProps = {}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const { i18n } = useTranslation();
    const uiRTL = i18n.dir() === "rtl";
    const NextArrow = uiRTL ? ArrowLeftCircle : ArrowRightCircle;
    const [idx, setIdx] = useState(0);
    const [fading, setFading] = useState(false);

    // Effective dark mode (mirrors useThemeEffect: explicit dark, or system +
    // OS prefers dark). Reactive to both the theme setting and OS changes, so
    // the Welcome screen follows the theme instead of being forced black.
    const theme = useSettingsStore((s) => s.theme);
    const [systemDark, setSystemDark] = useState(
        () => window.matchMedia("(prefers-color-scheme: dark)").matches
    );
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const on = () => setSystemDark(mq.matches);
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);
    const isDark = theme === "dark" || (theme === "system" && systemDark);
    const earStatic = isDark ? EAR_STATIC_DARK : EAR_STATIC_LIGHT;

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
        const timers: ReturnType<typeof setTimeout>[] = [];

        // Word holds, then fades out. (The ear breathes independently via CSS.)
        timers.push(setTimeout(() => setFading(true), DISPLAY_DURATION));

        // Advance to the next word.
        timers.push(setTimeout(() => {
            setIdx((i) => (i + 1) % welcomes.length);
            setFading(false);
        }, DISPLAY_DURATION + FADE_DURATION));

        return () => timers.forEach(clearTimeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, welcomes.length]);

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

    // Keep the FEATURED word on a single line. Long greetings (e.g. Cyrillic
    // "Добро пожаловать", "Ласкаво просимо") otherwise wrap to two lines and
    // spill over the cloud. We force nowrap and scale the word down just enough
    // to fit the column width.
    const wordRef = useRef<HTMLSpanElement>(null);
    const [wordScale, setWordScale] = useState(1);

    useLayoutEffect(() => {
        const el = wordRef.current;
        if (!el) return;
        el.style.transform = "scale(1)";
        const avail = el.clientWidth; // w-full → the column's inner width
        const natural = el.scrollWidth; // single-line text width (nowrap)
        setWordScale(natural > avail && avail > 0 ? Math.max(0.62, avail / natural) : 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx]);

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
            // pb-12 static — content is justify-center so the Next
            // button rarely brushes the nav bar, but a static value
            // (instead of env+calc) makes the math deterministic on
            // short viewports. See corpan-app/AGENTS.md §6.
            // Follows the theme. In dark mode we override to TRUE black (#000),
            // which is richer than the dark theme's --background (0.145) behind
            // the faded cloud + ear; in light mode the usual surface tokens.
            className="fixed inset-0 flex flex-col items-center justify-center px-6 gap-y-5 pb-12 bg-background"
            style={{
                backgroundColor: isDark ? "#000" : undefined,
                overflow: "hidden",
                paddingTop: "env(safe-area-inset-top)",
                paddingLeft: "max(env(safe-area-inset-left), 1.5rem)",
                paddingRight: "max(env(safe-area-inset-right), 1.5rem)",
            }}
        >
            {/* All-hearing-ear watermark. Centered, decorative, behind
                everything (pointer-events-none, z-0). Static by default; the
                slow polyrhythm breath is opt-in via EAR_BREATH. */}
            {EAR_BREATH ? (
                <style>{`@keyframes corpanEarBreath {
                    0%   { opacity: ${EAR_FLOOR}; }
                    10%  { opacity: ${EAR_FLOOR}; }
                    50%  { opacity: ${EAR_PEAK}; }
                    90%  { opacity: ${EAR_FLOOR}; }
                    100% { opacity: ${EAR_FLOOR}; }
                }`}</style>
            ) : null}
            <img
                src={corpanMark}
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute select-none"
                style={{
                    // Perfectly centered on the viewport (the root is fixed
                    // inset-0, so its padding box spans the full screen).
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    // Big — nearly fills the screen. Sized by height with a
                    // width safety (figure aspect ≈ 0.792, so width = 0.792·h):
                    // height capped at 84vh AND at 114vw worth of height, so
                    // the width never exceeds ~90vw. Generous margins on phone
                    // and iPad alike. width:auto keeps the natural aspect.
                    height: "min(78vh, 106vw)",
                    width: "auto",
                    objectFit: "contain",
                    opacity: EAR_BREATH ? EAR_FLOOR : earStatic,
                    animation: EAR_BREATH ? `corpanEarBreath ${EAR_CYCLE}ms ease-in-out infinite` : undefined,
                    zIndex: 0,
                    willChange: EAR_BREATH ? "opacity" : undefined,
                }}
            />

            {/* Animated welcome word */}
            <div
                className="flex flex-col items-center justify-center w-full"
                style={{
                    maxWidth: 600,
                    // Scales with viewport so the cloud rides close to the word
                    // on a phone (was a flat 80px → ~35px of dead air there).
                    minHeight: "clamp(48px, 11vw, 84px)",
                    position: "relative",
                    zIndex: 1,
                }}
            >
                <span
                    ref={wordRef}
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
                        textShadow: `0 2px 24px ${HIGHLIGHT}88, 0 0px 2px #3336`,
                        willChange: "opacity",
                        // One line always — scaled down to fit if a greeting is long.
                        whiteSpace: "nowrap",
                        transform: `scale(${wordScale})`,
                        transformOrigin: "center center",
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
                    position: "relative",
                    zIndex: 1,
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
                                        : `0 2px 24px ${HIGHLIGHT}88, 0 0px 2px #3339`
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
          border border-purple-400
          rounded-md
          transition
          outline-none ring-0 z-10
          text-3xl
          hover:cursor-pointer
        "
                style={{
                    // Opaque black so the ear watermark doesn't bleed through —
                    // the button reads as a clean solid disc over the pyramid,
                    // defined by its purple border + glow.
                    backgroundColor: "#000",
                    boxShadow: "0 8px 48px 0 #ac6df633",
                    width: 72,
                    height: 72,
                    borderWidth: 1,
                    borderStyle: "solid",
                    // Optical nudge: centering put it level with the TOP of
                    // "Corpán", but the word's visual mass sits lower (lowercase
                    // body), so drop the button a few px. marginBottom cancels
                    // the shift so the wordmark stays put.
                    marginTop: 8,
                    marginBottom: -8,
                }}
                onClick={onAdvance ?? (() => setStep(1))}
            >
                <NextArrow size={36} className="text-white" />
            </button>

            {/* Brand wordmark — under the button, sized like the rotating
                welcome word. Fixed, never translated (the ear watermark carries
                the logo; this carries the name). Tagline opt-in via
                SHOW_TAGLINE for A/B testing. */}
            <div
                className="flex flex-col items-center"
                style={{ position: "relative", zIndex: 1 }}
            >
                <span
                    className="font-bold text-foreground"
                    style={{
                        // Match the rotating welcome word's scale.
                        fontSize: "min(clamp(34px, 7vw, 64px), 10vh)",
                        letterSpacing: 1,
                        lineHeight: 1.1,
                    }}
                >
                    Corpán
                </span>
                {SHOW_TAGLINE ? (
                    <span
                        className="text-muted-foreground"
                        style={{
                            // Delicate — mirrors the word-cloud chip styling.
                            fontSize: "clamp(11px, 2.6vw, 22px)",
                            fontWeight: 500,
                            letterSpacing: 0.5,
                            marginTop: 6,
                        }}
                    >
                        {TAGLINE}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
