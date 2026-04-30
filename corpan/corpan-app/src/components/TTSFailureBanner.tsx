import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { openTtsSettings } from "@/util/tts-voices";

const VISIBLE_MS = 8000;
const RATE_LIMIT_MS = 60_000;

/**
 * Listens for `corpan:tts-failure` events and surfaces a brief, dismissible
 * banner with a one-tap link to the system TTS settings. Rate-limited to
 * avoid spamming the user during streams of failures.
 */
export function TTSFailureBanner() {
    const { t } = useTranslation();
    const [visible, setVisible] = useState(false);
    const [lastShownAt, setLastShownAt] = useState(0);

    useEffect(() => {
        function onFailure() {
            const now = Date.now();
            if (now - lastShownAt < RATE_LIMIT_MS) return;
            setLastShownAt(now);
            setVisible(true);
        }
        window.addEventListener("corpan:tts-failure", onFailure);
        return () => window.removeEventListener("corpan:tts-failure", onFailure);
    }, [lastShownAt]);

    useEffect(() => {
        if (!visible) return;
        const timer = window.setTimeout(() => setVisible(false), VISIBLE_MS);
        return () => window.clearTimeout(timer);
    }, [visible]);

    return (
        <AnimatePresence>
            {visible ? (
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    role="alert"
                    aria-live="polite"
                    className="fixed left-4 right-4 z-[60] mx-auto flex max-w-md items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/95 p-3 shadow-lg backdrop-blur dark:border-amber-900/60 dark:bg-amber-950/80"
                    style={{
                        top: "calc(env(safe-area-inset-top) + 0.75rem)",
                    }}
                >
                    <span
                        aria-hidden
                        className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300"
                    >
                        <AlertTriangle size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-foreground">
                            {t("ttsBanner.playbackFailedHeading", {
                                defaultValue: "Voice playback failed",
                            })}
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                            {t("ttsBanner.playbackFailedDetail", {
                                defaultValue:
                                    "Open your device's TTS settings to fix it.",
                            })}
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                void openTtsSettings();
                                setVisible(false);
                            }}
                            className="mt-2 inline-flex h-8 items-center rounded-md border border-amber-400 bg-amber-100 px-3 text-xs font-medium text-amber-900 shadow-sm hover:bg-amber-200 hover:cursor-pointer dark:border-amber-700 dark:bg-amber-900/60 dark:text-amber-100"
                        >
                            {t("ttsBanner.openSettingsAction", {
                                defaultValue: "Open TTS settings",
                            })}
                        </button>
                    </div>
                    <button
                        type="button"
                        aria-label={t("common.dismiss", { defaultValue: "Dismiss" })}
                        onClick={() => setVisible(false)}
                        className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-amber-100 hover:text-foreground hover:cursor-pointer dark:hover:bg-amber-900/60"
                    >
                        <X size={14} />
                    </button>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
