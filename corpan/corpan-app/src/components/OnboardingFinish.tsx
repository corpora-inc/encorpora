// encorpora/corpan/corpan-app/src/components/OnboardingFinish.tsx
import { useMemo } from "react";
import { useSettingsStore } from "@/store/settings";
import { OnboardingHeader, STEPS } from "./OnboardingHeader";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Github, Youtube, Newspaper, Globe, ExternalLink } from "lucide-react";

/** Fill these with your actual profiles */
const LINKS = [
    {
        key: "youtube",
        url: "https://www.youtube.com/@corpán1",
        Icon: Youtube,
        cls: "text-red-600",
    },
    {
        key: "github",
        url: "https://github.com/corpora-inc",
        Icon: Github,
        cls: "text-gray-900",
    },
    {
        key: "blog",
        url: "https://free2z.com/corpora",
        Icon: Newspaper,
        cls: "text-amber-600",
    },
    {
        key: "website",
        url: "https://encorpora.io",
        Icon: Globe,
        cls: "text-indigo-600",
    },
] as const;

const CURRENT_STEP_IDX = 4; // learning=0, tts=1, levels=2, domains=3, socials=4

export function OnboardingFinish() {
    const setStep = useSettingsStore((s) => s.setOnboardingStep);
    const setOnboarded = useSettingsStore((s) => s.setOnboarded);
    const dir = useSettingsStore((s) => s.dir);
    const { t } = useTranslation();

    const stepLabels = useMemo(
        () =>
            STEPS.map((s, i) =>
                i === CURRENT_STEP_IDX
                    ? t("onboarding.socialsStepTitle", { defaultValue: s.label })
                    : t(`onboarding.${s.key}`, { defaultValue: s.label })
            ),
        [t]
    );

    async function openExternal(url: string) {
        try {
            await openUrl(url);
        } catch {
            try {
                await navigator.clipboard.writeText(url);
            } catch { }
            // Fallback alert – translated
            alert(t("onboarding.linkCopied", { defaultValue: "Link copied to clipboard." }) + "\n" + url);
        }
    }

    return (
        <section
            id="onboarding-scroll"
            className="flex h-dvh min-h-[100svh] w-full flex-col overflow-y-auto overscroll-contain"
            style={{
                WebkitOverflowScrolling: "touch",
                paddingLeft: "env(safe-area-inset-left)",
                paddingRight: "env(safe-area-inset-right)",
            }}
            dir={dir()}
        >
            <OnboardingHeader
                title="Aloha!"
                steps={stepLabels}
                currentIndex={CURRENT_STEP_IDX}
                onBack={() => setStep(3)}
                onNext={() => setOnboarded(true)}
                canNext={true}

            />

            <main
                className="flex-1 min-h-0 px-4 pt-6"
                style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
            >
                <div className="mx-auto w-full max-w-xl">
                    {/* Hero text */}
                    <div className="mb-6 text-center">
                        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-300">
                            {t("onboarding.welcomeTitle", { defaultValue: "Join the community" })}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                            {t("onboarding.welcomeBody", {
                                defaultValue:
                                    "Follow our channels for updates, deep dives, and community learning sessions.",
                            })}
                        </p>
                    </div>

                    {/* Link grid */}
                    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {LINKS.map(({ key, url, Icon, cls }) => (
                            <li key={key}>
                                <button
                                    onClick={() => openExternal(url)}
                                    className="group w-full rounded-xl border border-gray-200 bg-background p-4 text-left shadow-sm transition hover:-translate-y-[1px] hover:border-black hover:shadow-md hover:bg-black/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black hover:cursor-pointer dark:border-slate-600 dark:bg-background dark:shadow-none dark:hover:border-white/70 dark:hover:bg-white/10 dark:focus-visible:ring-white/70"
                                    aria-label={t(`socials.${key}.cta`, { defaultValue: "Open link" })}
                                >
                                    <div className="flex items-center gap-3">
                                        <span
                                            className={`grid h-10 w-10 place-items-center rounded-lg bg-gray-100 ${cls} transition group-hover:scale-105 dark:bg-slate-800 dark:text-current`}
                                            aria-hidden
                                        >
                                            <Icon size={20} />
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                                                {t(`socials.${key}.title`, {
                                                    // sensible defaults per brand
                                                    defaultValue:
                                                        key === "youtube"
                                                            ? "Corpán Studios"
                                                            : key === "github"
                                                                ? "GitHub"
                                                                : key === "blog"
                                                                    ? "Free2Z Blog"
                                                                    : "Website",
                                                })}
                                            </div>
                                            <div className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-slate-400">
                                                {t(`socials.${key}.desc`, {
                                                    defaultValue:
                                                        key === "youtube"
                                                            ? "Tutorials, demos, and behind-the-scenes."
                                                            : key === "github"
                                                                ? "Star the repo and follow development."
                                                                : key === "blog"
                                                                    ? "Notes, release writeups, and essays."
                                                                    : "Product, docs, and announcements.",
                                                })}
                                            </div>

                                        </div>
                                        <ExternalLink
                                            size={16}
                                            className="shrink-0 text-gray-500 transition group-hover:text-gray-700 dark:text-slate-400 dark:group-hover:text-slate-200"
                                            aria-hidden
                                        />
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>

                    {/* Subtle nudge */}
                    <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400 pb-20">
                        {t("onboarding.welcomeFollowUp", {
                            defaultValue: "Thanks for being here - see you in the community!",
                        })}
                    </div>
                </div>
            </main>
        </section >
    );
}
