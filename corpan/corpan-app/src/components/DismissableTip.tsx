// encorpora/corpan/corpan-app/src/components/DismissableTip.tsx
import { useEffect, useId, useState } from "react";
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

export function DismissableTip({ title, body, storageKey, action, className }: Props) {
    const reactId = useId();
    const noteId = `tip-${reactId}`;

    const [dismissed, setDismissed] = useState(false);
    const [closing, setClosing] = useState(false);

    // hydrate from storage (once)
    useEffect(() => {
        if (!storageKey) return;
        try {
            const v = window.localStorage.getItem(storageKey);
            if (v === "1") setDismissed(true);
        } catch {
            /* ignore */
        }
    }, [storageKey]);

    const close = () => {
        if (closing || dismissed) return;
        setClosing(true);
    };

    // animate out then remove from layout
    useEffect(() => {
        setDismissed(false)
        if (!closing) return;
        const ms = 240;
        const tmr = window.setTimeout(() => {
            setDismissed(true);
            if (storageKey) {
                try {
                    window.localStorage.setItem(storageKey, "1");
                } catch {
                    /* ignore */
                }
            }
        }, ms);
        return () => window.clearTimeout(tmr);

    }, [closing, storageKey]);

    if (dismissed) return null;

    return (
        <div
            role="note"
            aria-labelledby={`${noteId}-title`}
            aria-describedby={`${noteId}-body`}
            className={[
                "relative mb-4 rounded-xl",
                "border border-purple-200/70 dark:border-purple-800/50",
                "bg-purple-50/40 dark:bg-purple-950/20",
                "shadow-sm",
                "px-3.5 py-3",
                "origin-top transition-all duration-300 ease-out",
                closing
                    ? "opacity-0 -translate-y-1 max-h-0 py-0 mb-0 border-0 shadow-none"
                    : "opacity-100",
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
    );
}
