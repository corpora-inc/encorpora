import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

/** Soft-pulsing skeleton that occupies the same vertical rhythm as the rescue card. */
export function OnboardingTTSProbing() {
    const { t } = useTranslation();
    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={t("onboarding.ttsRescue.probing", {
                defaultValue: "Setting up voices…",
            })}
            className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm"
        >
            <div className="mx-auto mb-4 h-14 w-14 animate-pulse rounded-2xl bg-muted" />
            <div className="mx-auto mb-2 h-5 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mx-auto mb-1 h-3 w-3/4 animate-pulse rounded bg-muted/70" />
            <div className="mx-auto h-3 w-1/2 animate-pulse rounded bg-muted/60" />
            <div className="mt-6 h-12 w-full animate-pulse rounded-md bg-muted" />
            <div className="mt-2 h-10 w-full animate-pulse rounded-md bg-muted/60" />
            <p className="mt-4 text-center text-xs text-muted-foreground">
                {t("onboarding.ttsRescue.probing", {
                    defaultValue: "Setting up voices…",
                })}
            </p>
        </div>
    );
}

/** Brief celebratory state shown after recovery succeeds (~800ms). */
export function OnboardingTTSReadyConfirm({ engine }: { engine?: string | null }) {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            role="status"
            aria-live="polite"
            className="mx-auto w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 shadow-sm dark:border-emerald-900/60 dark:bg-emerald-950/30"
        >
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/60">
                <CheckCircle2
                    size={28}
                    className="text-emerald-700 dark:text-emerald-300"
                />
            </div>
            <h2 className="text-center text-xl font-semibold text-foreground">
                {t("onboarding.ttsRescue.readyHeading", {
                    defaultValue: "Voices ready",
                })}
            </h2>
            {engine ? (
                <p className="mt-1 text-center text-xs text-muted-foreground">
                    {t("onboarding.ttsRescue.readyEngine", {
                        defaultValue: "Using {{engine}}",
                        engine,
                    })}
                </p>
            ) : null}
        </motion.div>
    );
}
