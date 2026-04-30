// src/components/onboarding/OnboardingPickPrimary.tsx

import {
    useSettingsStore,
    ALL_LANGUAGES,
    COMING_SOON_LANGUAGES,
} from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { isRTL } from "@/util/convert";
import {
    ArrowLeftCircle,
    ArrowRightCircle,
    Hourglass,
    Sparkles,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

/**
 * First-launch primary-language picker.
 *
 * Design goals:
 *   - The user has not yet picked a UI language, so every actionable label is
 *     rendered in its own target language ("Make English my primary language",
 *     "Imposta l'italiano come lingua principale", ...). The user only needs
 *     to recognize their own.
 *   - The browser/system locale, if it maps to a supported language, is
 *     surfaced first with a subtle Sparkles indicator — best-effort, never a
 *     forced default.
 *   - Layout is a vertical column, scrollable when content exceeds the
 *     viewport, no manual offset/translate gymnastics, no top padding from
 *     wrapper centering.
 *   - All five onboarding screens share the same `.wizard-shell` typography
 *     scope (see WizardShell.tsx), so user text-size settings don't reach in.
 */
export function OnboardingPickPrimary() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setLanguages = useSettingsStore((s) => s.setLanguages);
    const { i18n } = useTranslation();

    const handleSelect = (code: string) => {
        i18n.changeLanguage(code);
        setLanguages([code]);
        setStep(2);
    };

    // Best-effort locale detection — used only to pin a "suggested" row.
    const suggested = useMemo(() => detectPreferredLang(), []);

    const orderedLangs = useMemo(() => {
        if (!suggested) return ALL_LANGUAGES;
        return [suggested, ...ALL_LANGUAGES.filter((l) => l !== suggested)];
    }, [suggested]);

    return (
        <div
            className="mx-auto w-full max-w-xl px-4 flex flex-col gap-2"
            style={{
                paddingTop: "max(env(safe-area-inset-top), 0.75rem)",
                paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
            }}
        >
            <ul
                role="listbox"
                aria-label="Choose your primary language"
                className="flex flex-col gap-2 list-none p-0 m-0"
            >
                {orderedLangs.map((code) => (
                    <PrimaryLanguageButton
                        key={code}
                        code={code}
                        onSelect={handleSelect}
                    />
                ))}
            </ul>

            {COMING_SOON_LANGUAGES.length > 0 && (
                <section
                    aria-label="Languages coming soon"
                    className="flex flex-col gap-2 mt-6"
                >
                    <header className="flex items-center justify-center gap-2 mb-1">
                        <Hourglass
                            size={14}
                            className="text-muted-foreground/80"
                            aria-hidden="true"
                        />
                        <span className="text-xs font-medium tracking-wide text-muted-foreground">
                            More languages coming soon
                        </span>
                    </header>
                    <ul className="flex flex-col gap-2 list-none p-0 m-0">
                        {COMING_SOON_LANGUAGES.map((code) => (
                            <ComingSoonRow key={code} code={code} />
                        ))}
                    </ul>
                </section>
            )}
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function PrimaryLanguageButton({
    code,
    onSelect,
}: {
    code: string;
    onSelect: (code: string) => void;
}) {
    const label = TRANSLATIONS.getMakePrimaryLabel(code);
    const rtl = isRTL(code);
    const Arrow = rtl ? ArrowLeftCircle : ArrowRightCircle;

    return (
        <li role="option" aria-selected={false}>
            <button
                type="button"
                onClick={() => onSelect(code)}
                lang={code}
                dir={rtl ? "rtl" : "ltr"}
                className="
                    group relative w-full
                    px-5 py-4
                    rounded-xl
                    bg-background border border-border
                    text-base font-semibold text-foreground
                    flex items-center justify-between gap-3
                    text-start
                    cursor-pointer select-none break-words
                    transition-[background,border-color,transform,box-shadow]
                    hover:bg-accent hover:border-purple-400 hover:shadow-md
                    active:scale-[0.985]
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                "
                style={{
                    minHeight: 56,
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    lineHeight: 1.3,
                }}
            >
                <span className="flex-1">{label}</span>
                <Sparkles
                    size={14}
                    className="
                        shrink-0 text-purple-400
                        opacity-0
                        group-hover:opacity-100
                        group-focus-visible:opacity-100
                        transition-opacity duration-150
                    "
                    aria-hidden="true"
                />
                <Arrow
                    size={22}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden="true"
                />
            </button>
        </li>
    );
}

function ComingSoonRow({ code }: { code: string }) {
    const autonym = TRANSLATIONS.getAutonym(code);
    const statusLabel = TRANSLATIONS.getComingSoonLabel(code);
    const rtl = isRTL(code);

    return (
        <li role="option" aria-disabled="true">
            <div
                lang={code}
                dir={rtl ? "rtl" : "ltr"}
                className="
                    relative w-full
                    px-5 py-4
                    rounded-xl
                    border border-dashed border-border
                    bg-muted/40
                    flex items-center justify-between gap-3
                    text-start cursor-default select-none
                "
                style={{
                    minHeight: 56,
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    lineHeight: 1.3,
                }}
            >
                <span className="text-base font-semibold text-foreground/70">
                    {autonym}
                </span>
                <span className="flex items-center gap-2 shrink-0 text-[11px] font-medium text-muted-foreground">
                    <span className="max-w-[140px] truncate">{statusLabel}</span>
                    <Hourglass
                        size={12}
                        className="text-yellow-500 animate-pulse shrink-0"
                        aria-hidden="true"
                    />
                </span>
            </div>
        </li>
    );
}

/* -------------------------------------------------------------------------- */
/*  Locale detection                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Best-effort match from `navigator.language` / `navigator.languages` to a
 * supported language code. Tries exact match first, then primary-subtag.
 * Returns null if no reasonable match.
 */
function detectPreferredLang(): string | null {
    if (typeof navigator === "undefined") return null;
    const supported = ALL_LANGUAGES.map((l) => l.toLowerCase());
    const candidates = [
        navigator.language,
        ...(navigator.languages || []),
    ]
        .filter((s): s is string => Boolean(s))
        .map((s) => s.toLowerCase());

    // Exact match (e.g. "pt-br" → "pt-br")
    for (const c of candidates) {
        const hit = supported.indexOf(c);
        if (hit >= 0) return ALL_LANGUAGES[hit];
    }
    // Primary-subtag match (e.g. "pt-pt" → "pt-br" if pt-br exists)
    for (const c of candidates) {
        const prefix = c.split("-")[0];
        const hit = supported.findIndex(
            (s) => s === prefix || s.startsWith(prefix + "-"),
        );
        if (hit >= 0) return ALL_LANGUAGES[hit];
    }
    return null;
}
