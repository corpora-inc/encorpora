// encorpora/corpan/corpan-app/src/components/DismissableTip.tsx
import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Lightbulb, X } from "lucide-react";

type Props = {
    title: string;
    body: string;

    /**
     * Optional: persist dismissal across screens/sessions.
     * - If provided, tip stays dismissed until storage cleared.
     * - Use a stable key like "tip:language-order" or "tip:tts-os".
     */
    storageKey?: string;

    /**
     * Optional action button to show below the body text.
     */
    action?: {
        label: string;
        onClick: () => void;
        icon?: React.ReactNode;
    };

    /**
     * Layout tweaks (kept minimal so tips look identical everywhere).
     */
    className?: string; // wrapper spacing override if needed (rare)
};

/**
 * A tip card that dismisses with a smooth height-collapse. We let framer-motion
 * measure + tween the real height (`AnimatePresence` + animated `height`),
 * rather than CSS `max-height` (which can't tween from `auto` and flickers).
 * Respects prefers-reduced-motion. Persists dismissal on storageKey.
 */
export function DismissableTip({ title, body, storageKey, action, className }: Props) {
    const reactId = useId();
    const noteId = `tip-${reactId}`;
    const reduce = useReducedMotion();

    // `gone` = never render (hydrated-from-storage as dismissed, or exit done).
    const [gone, setGone] = useState(false);
    // `show` drives the enter/exit animation; flip to false to play the collapse.
    const [show, setShow] = useState(true);

    useEffect(() => {
        if (!storageKey) return;
        try {
            if (window.localStorage.getItem(storageKey) === "1") setGone(true);
        } catch {
            /* ignore */
        }
    }, [storageKey]);

    const close = () => {
        // Persist immediately; the exit animation then plays out and unmounts.
        if (storageKey) {
            try {
                window.localStorage.setItem(storageKey, "1");
            } catch {
                /* ignore */
            }
        }
        setShow(false);
    };

    if (gone) return null;

    return (
        <AnimatePresence initial={false} onExitComplete={() => setGone(true)}>
            {show ? (
                <motion.div
                    key="tip"
                    // Animate the real measured height so the collapse is buttery;
                    // overflow-hidden clips content as it shrinks.
                    initial={false}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={
                        reduce
                            ? { duration: 0 }
                            : { duration: 0.24, ease: [0.4, 0, 0.2, 1] }
                    }
                    className="mb-4 overflow-hidden"
                >
                    <div
                        role="note"
                        aria-labelledby={`${noteId}-title`}
                        aria-describedby={`${noteId}-body`}
                        className={[
                            "relative rounded-xl",
                            "border border-purple-200/70 dark:border-purple-800/50",
                            "bg-purple-50/40 dark:bg-purple-950/20",
                            "shadow-sm px-3.5 py-3",
                            className ?? "",
                        ].join(" ")}
                    >
                        <button
                            type="button"
                            onClick={close}
                            className="
                                absolute end-1.5 top-1.5 z-10
                                rounded-md p-1
                                text-muted-foreground/60
                                transition-colors
                                hover:bg-purple-100/70 hover:text-foreground
                                dark:hover:bg-purple-900/40
                                focus:outline-none focus-visible:ring-1 focus-visible:ring-purple-400
                                cursor-pointer
                            "
                            aria-label="Close"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>

                        <div className="flex items-start gap-2.5 pe-6">
                            <Lightbulb
                                className="mt-0.5 h-4 w-4 shrink-0 text-purple-500 dark:text-purple-300"
                                aria-hidden="true"
                            />

                            <div className="min-w-0 flex-1">
                                <div
                                    id={`${noteId}-title`}
                                    className="text-xs font-semibold tracking-wide text-foreground"
                                >
                                    {title}
                                </div>

                                <div
                                    id={`${noteId}-body`}
                                    className="mt-0.5 text-xs leading-relaxed text-muted-foreground"
                                >
                                    {body}
                                </div>

                                {action && (
                                    <button
                                        type="button"
                                        onClick={action.onClick}
                                        className="
                                            mt-2 inline-flex items-center gap-1.5
                                            rounded-md border border-border bg-background
                                            px-2.5 py-1
                                            text-xs font-medium text-foreground
                                            transition-[background,border-color]
                                            hover:border-purple-300 hover:bg-accent
                                            focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                                            cursor-pointer
                                        "
                                        aria-label={action.label}
                                    >
                                        {action.icon}
                                        <span>{action.label}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
