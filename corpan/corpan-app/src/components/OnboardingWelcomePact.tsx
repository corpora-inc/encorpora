// src/components/OnboardingWelcomePact.tsx
//
// The "honest hello" interlude — shown right after the user picks their primary
// language and before "What brings you to Corpán?". Its whole job is to set
// expectations and build a human connection in the user's OWN language.
//
// Tone: warm, candid, ambitious, and collaborative. The user should understand
// that Corpán moves quickly at the edge of on-device technology, and that their
// language knowledge and ideas can help shape where it goes.
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Sparkles, FlaskConical, Languages, MessageCircleHeart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/store/settings";
import { OnboardingShell } from "@/onboarding/OnboardingShell";
import type { OnboardingStepProps } from "@/onboarding/types";

const SUPPORT_EMAIL = "team@encorpora.io";
const GITHUB_ISSUES = "https://github.com/corpora-inc/encorpora/issues";

export function OnboardingWelcomePact({ onAdvance, onBack }: OnboardingStepProps = {}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const primary = useSettingsStore((s) => s.languages[0]) || "en";
    const { t } = useTranslation();

    // The chosen language's name, IN that language (e.g. "العربية"), so the
    // personal lines read natively. Falls back to the code if unmapped.
    const lang = t(`languages.${primary}`, { defaultValue: primary });

    async function openExternal(url: string) {
        try {
            await openUrl(url);
        } catch {
            try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        }
    }

    const advance = onAdvance ?? (() => setStep(2));

    const ROWS = [
        {
            Icon: Sparkles,
            title: t("onboarding.welcomePact.tinyTeamTitle", { defaultValue: "A tiny team of enthusiasts" }),
            desc: t("onboarding.welcomePact.tinyTeamDesc", {
                defaultValue: "Independent, ad-free, and built with respect for the people who use it — a small crew making the language app we always wanted.",
            }),
        },
        {
            Icon: FlaskConical,
            title: t("onboarding.welcomePact.bleedingEdgeTitle", { defaultValue: "Cutting-edge, on purpose" }),
            desc: t("onboarding.welcomePact.bleedingEdgeDesc", {
                defaultValue: "Corpán pushes the limits of what your device can do: immersive worlds, speech recognition, natural voices, and the latest AI models, all working together to create new ways to learn. Much of it runs directly on your device, giving you private, offline-first learning without depending on a data center. We release new technology while it is still raw, which means it may occasionally behave strangely, run slowly, or simply be more than your device can handle. In return, you get powerful new learning experiences as soon as they become possible.",
            }),
        },
        {
            Icon: Languages,
            title: t("onboarding.welcomePact.yourLangTitle", { defaultValue: "We don't speak every language we support" }),
            desc: t("onboarding.welcomePact.yourLangDesc", {
                defaultValue: "That's the honest truth. We're building for dozens of languages because everyone deserves powerful learning tools, not because our tiny team already knows them all. You may find things we got wrong. If you know {{lang}} better than we do, we hope you'll tell us and help make Corpán worthy of it.",
                lang,
            }),
        },
    ];

    return (
        <OnboardingShell
            canBack
            onBack={onBack ?? (() => setStep(1))}
            maxWidthClass="max-w-xl"
            footer={
                <div>
                    <p className="mb-2 text-center text-[11px] leading-snug text-muted-foreground/80">
                        {t("onboarding.welcomePact.pact", {
                            defaultValue: "Tap below to start learning and grow with us. 🤝",
                        })}
                    </p>
                    <Button className="w-full !h-12" onClick={advance}>
                        {t("onboarding.welcomePact.cta", { defaultValue: "I'm in — let's go" })}
                    </Button>
                </div>
            }
        >
            <h1 className="text-center text-2xl font-bold text-foreground">
                {t("onboarding.welcomePact.title", { defaultValue: "Corpán Evolves" })}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                {t("onboarding.welcomePact.subtitle", {
                    defaultValue: "You're an early adopter",
                })}
            </p>

            <ul className="mt-6 flex w-full flex-col gap-3">
                {ROWS.map(({ Icon, title, desc }, i) => (
                    <li
                        key={i}
                        className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-start"
                    >
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-500/10 text-purple-400" aria-hidden>
                            <Icon size={18} />
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-foreground">{title}</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</div>
                        </div>
                    </li>
                ))}
            </ul>

            {/* Invitation to share corrections, ideas, and new learning experiences. */}
            <div className="mt-4 w-full rounded-xl border border-purple-400/40 bg-gradient-to-br from-purple-500/[0.1] to-purple-500/[0.02] p-4 text-start">
                <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-500/15 text-purple-400" aria-hidden>
                        <MessageCircleHeart size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs leading-relaxed text-foreground/90">
                            {t("onboarding.welcomePact.plea", {
                                defaultValue: "Have an idea, a correction, or a wild learning experience you want to see? Tell us. We read every message and think deeply about what it could unlock for Corpán and language learning.",
                            })}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={() => openExternal(`mailto:${SUPPORT_EMAIL}`)}
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-purple-400/60"
                            >
                                {t("onboarding.welcomePact.emailCta", { defaultValue: "Email us" })}
                            </button>
                            <button
                                type="button"
                                onClick={() => openExternal(GITHUB_ISSUES)}
                                className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition hover:border-purple-400/60"
                            >
                                {t("onboarding.welcomePact.githubCta", { defaultValue: "Open a GitHub issue" })}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Recruitment — an invitation to help bring Corpán to the world. */}
            <button
                type="button"
                onClick={() => openExternal(GITHUB_ISSUES)}
                className="mt-3 flex w-full items-center gap-3 rounded-xl border border-dashed border-border/70 bg-card/50 p-3 text-start transition hover:border-purple-400/50"
            >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted-foreground" aria-hidden>
                    <Users size={18} />
                </span>
                <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {t("onboarding.welcomePact.join", {
                        defaultValue: "Want to help bring Corpán to the world? We're always looking for collaborators, translators, and local ambassadors. Come find us.",
                    })}
                </span>
            </button>
        </OnboardingShell>
    );
}
