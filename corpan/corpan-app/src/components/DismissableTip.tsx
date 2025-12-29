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
                "mb-5 rounded-2xl border border-amber-200 bg-amber-50 shadow-sm",
                "px-4 py-3",
                "origin-top transition-all duration-500 ease-out",
                closing
                    ? "opacity-0 scale-95 -translate-y-1 max-h-0 py-0 mb-0"
                    : "opacity-100 scale-100 max-h-40",
                className ?? "",
            ].join(" ")}
        >
            <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 rounded-xl bg-amber-100 p-2">
                    <Lightbulb className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div
                            id={`${noteId}-title`}
                            className="text-sm font-semibold text-amber-950"
                        >
                            {title}
                        </div>

                        <button
                            type="button"
                            onClick={close}
                            className="shrink-0 rounded-md p-1 text-amber-900/70 hover:bg-amber-100 hover:text-amber-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400 cursor-pointer"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    <div
                        id={`${noteId}-body`}
                        className="mt-0.5 text-sm leading-snug text-amber-900"
                    >
                        {body}
                    </div>

                    {action && (
                        <button
                            type="button"
                            onClick={action.onClick}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-900 shadow-sm transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 cursor-pointer"
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
