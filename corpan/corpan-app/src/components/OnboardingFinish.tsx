// encorpora/corpan/corpan-app/src/components/OnboardingFinish.tsx
//
// The ONE engagement page (replaces the separate "Join the Corpanistas" pitch
// interlude + the old "Aloha" socials page). Shown once near the end of
// onboarding: a warm welcome, our channels, and a SOFT "support/join" option —
// never a hard paywall. The real Plus moment lives at engagement (reader EOF,
// PaywallSheet), not here.
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useState } from "react";
import { Github, Youtube, Newspaper, Globe, Instagram, ExternalLink, Sparkles, Share2, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OnboardingShell } from "@/onboarding/OnboardingShell";
import { usePaywallStore } from "@/store/paywall";
import { useEntitlementStore } from "@/store/entitlements";
import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/latestVersion";
import { trackOnboardingCompleted } from "@/util/analytics";
import type { OnboardingStepProps } from "@/onboarding/types";

// One calm neutral tone for every icon — matches the "What do you want to do?"
// choice icons; the per-service brand colors (red/pink/amber/indigo) clashed.
const LINK_ICON_CLS = "text-muted-foreground";
const LINKS = [
    { key: "youtube", url: "https://www.youtube.com/@corpán1", Icon: Youtube, cls: LINK_ICON_CLS },
    { key: "instagram", url: "https://instagram.com/corpanapp", Icon: Instagram, cls: LINK_ICON_CLS },
    { key: "github", url: "https://github.com/corpora-inc", Icon: Github, cls: LINK_ICON_CLS },
    { key: "blog", url: "https://free2z.com/corpora", Icon: Newspaper, cls: LINK_ICON_CLS },
    { key: "website", url: "https://encorpora.io", Icon: Globe, cls: LINK_ICON_CLS },
] as const;

export function OnboardingFinish({ onAdvance, onBack }: OnboardingStepProps = {}) {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setOnboarded = useSettingsStore((s) => s.setOnboarded);
    const openPaywall = usePaywallStore((s) => s.openPaywall);
    const iapAvailable = useEntitlementStore((s) => s.iapAvailable);
    const subscribed = useEntitlementStore((s) => s.subscription.active);
    const { t } = useTranslation();

    async function openExternal(url: string) {
        try {
            await openUrl(url);
        } catch {
            try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
        }
    }

    // Native share sheet (Messages, etc.) so users can text friends. Includes
    // BOTH store links + a short line — the sender and recipient may be on
    // different platforms, so we don't guess (no smart-redirect link exists).
    // Text-only (no `url` field) so both links survive in the shared body.
    const [shareCopied, setShareCopied] = useState(false);
    async function shareCorpan() {
        const pitch = t("socials.share.text", {
            defaultValue: "Learn languages with Corpán.",
        });
        const message = `${pitch}\n\niOS: ${APP_STORE_URL}\nAndroid: ${PLAY_STORE_URL}`;
        try {
            if (typeof navigator !== "undefined" && navigator.share) {
                await navigator.share({ title: "Corpán", text: message });
                return;
            }
        } catch {
            // user cancelled the sheet, or share is unsupported — fall through to copy
        }
        try {
            await navigator.clipboard.writeText(message);
            setShareCopied(true);
            window.setTimeout(() => setShareCopied(false), 2000);
        } catch {
            /* clipboard unavailable */
        }
    }

    const advance =
        onAdvance ??
        (() => {
            // Legacy path (outside the engine): complete onboarding here.
            trackOnboardingCompleted();
            setOnboarded(true);
        });

    return (
        <OnboardingShell
            canBack
            onBack={onBack ?? (() => setStep(4))}
            maxWidthClass="max-w-xl"
            footer={
                <Button className="w-full !h-12" onClick={advance}>
                    {t("onboarding.engage.start", { defaultValue: "Start exploring" })}
                </Button>
            }
        >
            <h1 className="text-center text-2xl font-bold text-foreground">
                {t("onboarding.engage.title", { defaultValue: "You're all set" })}
            </h1>
            <p className="mt-2 text-center text-sm text-muted-foreground">
                {t("onboarding.engage.subtitle", {
                    defaultValue:
                        "Corpán is made by a tiny open-source team. Come say hi — and if you love it, you can support us.",
                })}
            </p>

            <ul className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {/* Soft join/support. Subscribers get a gracious, non-interactive
                    thank-you chip instead of a button that would no-op against the
                    paywall's "never nag subscribers" guard. */}
                {iapAvailable && !subscribed ? (
                    <li className="sm:col-span-2">
                        <button
                            type="button"
                            onClick={() => openPaywall({ surface: "onboarding_pitch" })}
                            className="group w-full rounded-xl border border-purple-400/50 bg-gradient-to-br from-purple-500/[0.12] to-purple-500/[0.03] p-4 text-left transition hover:border-purple-400/80"
                        >
                            <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-lg bg-purple-500/15 text-purple-400">
                                    <Sparkles size={20} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-foreground">
                                        {t("onboarding.engage.joinTitle", { defaultValue: "Join the Corpanistas" })}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        {t("onboarding.engage.joinDesc", { defaultValue: "Support Corpán and unlock everything. Optional, anytime." })}
                                    </div>
                                </div>
                                <ExternalLink size={16} className="shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
                            </div>
                        </button>
                    </li>
                ) : iapAvailable && subscribed ? (
                    <li className="sm:col-span-2">
                        <div className="w-full rounded-xl border border-purple-400/50 bg-gradient-to-br from-purple-500/[0.12] to-purple-500/[0.03] p-4 text-left">
                            <div className="flex items-center gap-3">
                                <span className="grid h-10 w-10 place-items-center rounded-lg bg-purple-500/15 text-purple-400">
                                    <Heart size={20} className="fill-current" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-semibold text-foreground">
                                        {t("onboarding.engage.subscribedTitle", { defaultValue: "You're a Corpanista" })}
                                    </div>
                                    <div className="mt-0.5 text-xs text-muted-foreground">
                                        {t("onboarding.engage.subscribedDesc", { defaultValue: "Thank you for keeping Corpán ad-free and growing." })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </li>
                ) : null}

                {LINKS.map(({ key, url, Icon, cls }) => (
                    <li key={key}>
                        <button
                            type="button"
                            onClick={() => openExternal(url)}
                            className="group w-full rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-[1px] hover:border-purple-400/60 hover:shadow-md"
                            aria-label={t(`socials.${key}.cta`, { defaultValue: "Open link" })}
                        >
                            <div className="flex items-center gap-3">
                                <span className={`grid h-10 w-10 place-items-center rounded-lg ${cls}`} aria-hidden>
                                    <Icon size={20} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <div className="truncate text-sm font-semibold text-foreground">
                                        {t(`socials.${key}.title`, {
                                            defaultValue:
                                                key === "youtube" ? "Corpán Studios"
                                                    : key === "instagram" ? "Follow on Instagram"
                                                        : key === "github" ? "GitHub"
                                                            : key === "blog" ? "Free2Z Blog"
                                                                : "Website",
                                        })}
                                    </div>
                                </div>
                                <ExternalLink size={16} className="shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
                            </div>
                        </button>
                    </li>
                ))}

                {/* Share — opens the native share sheet so users can text the
                    link to friends (6th tile completes the 2-col grid). */}
                <li>
                    <button
                        type="button"
                        onClick={() => void shareCorpan()}
                        className="group w-full rounded-xl border border-border bg-card p-4 text-left transition hover:-translate-y-[1px] hover:border-purple-400/60 hover:shadow-md"
                        aria-label={t("socials.share.title", { defaultValue: "Share Corpán" })}
                    >
                        <div className="flex items-center gap-3">
                            <span className={`grid h-10 w-10 place-items-center rounded-lg ${LINK_ICON_CLS}`} aria-hidden>
                                <Share2 size={20} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-foreground">
                                    {shareCopied
                                        ? t("socials.share.copied", { defaultValue: "Link copied!" })
                                        : t("socials.share.title", { defaultValue: "Share Corpán" })}
                                </div>
                            </div>
                            <ExternalLink size={16} className="shrink-0 text-muted-foreground transition group-hover:text-foreground" aria-hidden />
                        </div>
                    </button>
                </li>
            </ul>
        </OnboardingShell>
    );
}
