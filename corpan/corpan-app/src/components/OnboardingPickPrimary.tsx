// src/components/OnboardingPickPrimary.tsx
//
// First-launch primary-language picker — the app's true first impression.
//
// Design intent:
//   - The page is its own full-viewport scrollport (`fixed inset-0`), so the
//     OS scrollbar lives on the actual right edge of the device, not inset
//     hundreds of pixels under the WizardShell's old max-width.
//   - No English UI chrome — the user has not picked a UI language yet. The
//     only typography we trust to be universal is the wordmark and the digit
//     count. Every actionable row renders in its own target language
//     ("Hacer que el español sea mi idioma principal", ...) and the user
//     only needs to recognize their own.
//   - Best-effort locale detection floats the matched row to the top with a
//     persistent (not hover-only) ring affordance, and we eagerly apply the
//     detected language to i18next so the rest of the onboarding lands
//     localized. The user can still pick anything; their tap is final.
//   - The list is the celebration — ~50 native scripts in a single column.
//     Header is two lines: the wordmark and the language count. Nothing else.
//   - Coming-soon section is separated by a single muted hourglass — no
//     English "More languages coming soon" header — and each row carries its
//     own native autonym + native "coming soon" label.
//   - Buttons reach a slightly wider max-w-2xl on md+ so iPad doesn't feel
//     pinched, while phone widths stay at max-w-xl for thumb-friendly reach.

import {
    useSettingsStore,
    ALL_LANGUAGES,
    COMING_SOON_LANGUAGES,
} from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { isRTL } from "@/util/convert";
import { ChevronLeft, ChevronRight, Hourglass } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import corpanMark from "@/assets/corpan-mark-trim.png";
import { useApplyLang, detectPreferredLang } from "@/onboarding/useApplyLang";
import type { OnboardingStepProps } from "@/onboarding/types";

export function OnboardingPickPrimary({ onAdvance }: OnboardingStepProps = {}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setLanguages = useSettingsStore((s) => s.setLanguages);
    const { i18n } = useTranslation();

    // Best-effort match from the OS / browser locale to a supported language.
    // Used both to pre-localize downstream onboarding screens and to mark a
    // single suggested row.
    const suggested = useMemo(() => detectPreferredLang(), []);

    // Race-safe i18n setter (shared with the onboarding engine).
    const applyLang = useApplyLang();

    // Apply the detected UI language eagerly so downstream onboarding pages
    // land already localized. The race guard keeps a quick user tap from
    // being clobbered by this in-flight call.
    useEffect(() => {
        if (suggested && i18n.language !== suggested) {
            void applyLang(suggested);
        }
    }, [suggested, i18n, applyLang]);

    const handleSelect = (code: string) => {
        setLanguages([code]);
        void applyLang(code);
        (onAdvance ?? (() => setStep(2)))();
    };

    const orderedLangs = useMemo(() => {
        if (!suggested) return ALL_LANGUAGES;
        return [suggested, ...ALL_LANGUAGES.filter((l) => l !== suggested)];
    }, [suggested]);

    return (
        <div
            className="fixed inset-0 overflow-y-auto overscroll-contain bg-background"
            style={{
                WebkitOverflowScrolling: "touch",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
            }}
        >
            <div
                // pb-20 static — env(safe-area-inset-bottom) returns 0
                // on Android Tauri and is undersized in some iPad
                // contexts (see corpan-app/AGENTS.md §6). Top padding
                // keeps the env-calc since env() is reliable for top
                // safe area on both platforms.
                className="mx-auto w-full max-w-xl md:max-w-2xl px-4 sm:px-6 pb-20"
                style={{
                    paddingTop: "calc(env(safe-area-inset-top) + 2rem)",
                }}
            >
                <Header />

                <ul
                    role="listbox"
                    aria-label="Choose your primary language"
                    className="flex flex-col gap-2.5 list-none p-0 m-0"
                >
                    {orderedLangs.map((code, i) => (
                        <PrimaryLanguageButton
                            key={code}
                            code={code}
                            suggested={code === suggested}
                            stagger={i}
                            onSelect={handleSelect}
                        />
                    ))}
                </ul>

                {COMING_SOON_LANGUAGES.length > 0 && (
                    <section
                        aria-label="Languages coming soon"
                        className="mt-12 flex flex-col"
                    >
                        <div
                            className="flex items-center justify-center mb-5"
                            aria-hidden="true"
                        >
                            <Hourglass
                                size={14}
                                className="text-muted-foreground/40"
                            />
                        </div>
                        <ul className="flex flex-col gap-2 list-none p-0 m-0">
                            {COMING_SOON_LANGUAGES.map((code, i) => (
                                <ComingSoonRow
                                    key={code}
                                    code={code}
                                    stagger={orderedLangs.length + i}
                                />
                            ))}
                        </ul>
                    </section>
                )}
            </div>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Header                                                                    */
/* -------------------------------------------------------------------------- */

function Header() {
    return (
        <header className="flex flex-col items-center mb-5 sm:mb-6 select-none">
            {/* Tiny all-hearing-ear mark above the wordmark (replaces the
                old language count). */}
            <img
                src={corpanMark}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="select-none"
                style={{ height: 26, width: "auto" }}
            />
            <span
                lang="en"
                className="mt-2 font-medium text-foreground/95"
                style={{
                    fontSize: 24,
                    letterSpacing: "0.04em",
                    lineHeight: 1,
                }}
            >
                Corpán
            </span>
        </header>
    );
}

/* -------------------------------------------------------------------------- */
/*  Rows                                                                      */
/* -------------------------------------------------------------------------- */

const STAGGER_MS = 18;
const STAGGER_CAP = 28; // stop staggering after this many rows so the tail
//                        doesn't feel sluggish on long lists

function staggerStyle(i: number): React.CSSProperties {
    const idx = Math.min(i, STAGGER_CAP);
    return {
        animation: "corpan-fade-rise 320ms ease-out both",
        animationDelay: `${idx * STAGGER_MS}ms`,
    };
}

function PrimaryLanguageButton({
    code,
    suggested,
    stagger,
    onSelect,
}: {
    code: string;
    suggested: boolean;
    stagger: number;
    onSelect: (code: string) => void;
}) {
    const label = TRANSLATIONS.getMakePrimaryLabel(code);
    const rtl = isRTL(code);
    const Arrow = rtl ? ChevronLeft : ChevronRight;

    return (
        <li role="option" aria-selected={false} style={staggerStyle(stagger)}>
            <button
                type="button"
                onClick={() => onSelect(code)}
                lang={code}
                data-lang={code}
                dir={rtl ? "rtl" : "ltr"}
                className={[
                    "group relative w-full",
                    "px-5 py-4 rounded-xl",
                    "bg-card text-foreground",
                    "flex items-center justify-between gap-3 text-start",
                    "cursor-pointer select-none break-words",
                    "transition-[background-color,border-color,box-shadow,transform]",
                    "duration-150",
                    "active:scale-[0.985]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/70",
                    suggested
                        ? "border border-purple-400/70 ring-1 ring-purple-400/45 bg-purple-500/[0.08] hover:border-purple-400/90 hover:ring-purple-400/60"
                        : "border border-border hover:border-purple-400/55 hover:bg-accent/40",
                ].join(" ")}
                style={{
                    minHeight: 56,
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.35,
                }}
            >
                <span className="flex-1">{label}</span>
                <Arrow
                    size={18}
                    className={[
                        "shrink-0 transition-colors duration-150",
                        suggested
                            ? "text-purple-400/80 group-hover:text-purple-300"
                            : "text-muted-foreground/55 group-hover:text-foreground/80",
                    ].join(" ")}
                    aria-hidden="true"
                />
            </button>
        </li>
    );
}

function ComingSoonRow({ code, stagger }: { code: string; stagger: number }) {
    const autonym = TRANSLATIONS.getAutonym(code);
    const statusLabel = TRANSLATIONS.getComingSoonLabel(code);
    const rtl = isRTL(code);

    return (
        <li role="option" aria-disabled="true" style={staggerStyle(stagger)}>
            <div
                lang={code}
                dir={rtl ? "rtl" : "ltr"}
                className="
                    relative w-full
                    px-5 py-3 rounded-xl
                    border border-dashed border-border/55
                    bg-muted/25
                    flex items-center justify-between gap-3 text-start
                    select-none break-words
                "
                style={{
                    minHeight: 48,
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    fontSize: 16,
                    fontWeight: 500,
                    lineHeight: 1.35,
                }}
            >
                <span className="flex-1 text-foreground/55">{autonym}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground/60 max-w-[160px] truncate">
                    {statusLabel}
                </span>
            </div>
        </li>
    );
}

// Locale detection now lives in @/onboarding/useApplyLang (shared with the
// onboarding engine).
