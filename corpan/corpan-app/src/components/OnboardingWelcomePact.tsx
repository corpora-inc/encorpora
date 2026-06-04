// src/components/OnboardingWelcomePact.tsx
//
// The "honest hello" interlude — shown right after the user picks their primary
// language and before "What brings you to Corpán?". Its whole job is to set
// expectations and build a human connection in the user's OWN language, so a
// frustrated early adopter emails us instead of leaving a heartbreak rating.
//
// Tone: warm, candid, a little funny. NOT a review-gate. We never condition app
// use on a rating and never tell users they may not rate low — that would risk
// App Store / Play rejection (both stores forbid manipulating reviews). Instead
// we make a heartfelt, openly-joking "early adopter pact": expect rough edges,
// please send feedback instead of a sad rating, grow with us. The plea routes
// unhappy users to email / GitHub (the accepted, compliant pattern).
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
            title: t("onboarding.welcomePact.tinyTeamTitle", { defaultValue: "Two people, not a big company" }),
            desc: t("onboarding.welcomePact.tinyTeamDesc", {
                defaultValue: "No ads, no investors, almost everything free. We pour our own time and money into this.",
            }),
        },
        {
            Icon: FlaskConical,
            title: t("onboarding.welcomePact.bleedingEdgeTitle", { defaultValue: "Bleeding-edge and brand-new" }),
            desc: t("onboarding.welcomePact.bleedingEdgeDesc", {
                defaultValue: "50 languages, any to any — nobody has tried this before. Expect a few rough edges, a clumsy phrase, maybe a crash. We ship fixes every week.",
            }),
        },
        {
            Icon: Languages,
            title: t("onboarding.welcomePact.yourLangTitle", { defaultValue: "We're still mastering {{lang}}", lang }),
            desc: t("onboarding.welcomePact.yourLangDesc", {
                defaultValue: "We don't natively speak every language we support. We work around the clock to make {{lang}} excellent — and your feedback is how it gets there.",
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
                            defaultValue: "By tapping below you join as an early adopter 🤝 — expect a few bugs, send feedback instead of a sad rating, and grow with us. (Not legally binding. Emotionally? Very.)",
                        })}
                    </p>
                    <Button className="w-full !h-12" onClick={advance}>
                        {t("onboarding.welcomePact.cta", { defaultValue: "I'm in — let's go" })}
                    </Button>
                </div>
            }
        >
            <h1 className="text-center text-2xl font-bold text-foreground">
                {t("onboarding.welcomePact.title", { defaultValue: "First, the honest part" })}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                {t("onboarding.welcomePact.subtitle", {
                    defaultValue: "Thirty seconds, then we'll set up {{lang}} for you.",
                    lang,
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

            {/* The heartfelt plea — feedback over a low rating. Compliant: we ask,
                we don't gate. */}
            <div className="mt-4 w-full rounded-xl border border-purple-400/40 bg-gradient-to-br from-purple-500/[0.1] to-purple-500/[0.02] p-4 text-start">
                <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-purple-500/15 text-purple-400" aria-hidden>
                        <MessageCircleHeart size={18} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="text-xs leading-relaxed text-foreground/90">
                            {t("onboarding.welcomePact.plea", {
                                defaultValue: "If something's wrong, please tell us — we read every word and fix fast. A silent 1-star just breaks our hearts and we can't fix what we can't see. Love it? Five stars mean the world. Not your thing? No worries — just keep scrolling.",
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

            {/* Recruitment — a personal ask to the speaker of this language. */}
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
                        defaultValue: "Want to help bring Corpán to {{lang}}? We're looking for collaborators, translators, and local ambassadors — with real revenue share. Come find us.",
                        lang,
                    })}
                </span>
            </button>
        </OnboardingShell>
    );
}
