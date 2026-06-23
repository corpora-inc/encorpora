// src/components/OfflineNotice.tsx
//
// A single, consistent inline empty/notice card for offline states.
// Matches the dashed-border / muted-tone visual already established by
// PhrasePackBrowser, OnboardingPickPhrasePacks, and the empty-state cards
// scattered across the pack listings.
//
// Two densities:
//   - default: large empty-state card (replaces "Connect to browse…" blocks)
//   - compact: slim inline strip (replaces the "Offline — selections install
//              when reconnected" thin banner in OnboardingPickPhrasePacks)
//
// Use `useOnlineStatus()` to decide whether to render — this component does
// not gate itself, so callers can compose with their own conditions
// (e.g. offline + no cached catalog).

import { CloudOff } from "lucide-react";
import type { ReactNode } from "react";

type Density = "default" | "compact";

export function OfflineNotice({
    title,
    subtitle,
    action,
    density = "default",
    className,
}: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    density?: Density;
    className?: string;
}) {
    if (density === "compact") {
        return (
            <div
                role="status"
                aria-live="polite"
                className={[
                    "mx-auto max-w-md rounded-md border border-dashed border-border bg-muted/30",
                    "px-3 py-2 flex items-center justify-center gap-2",
                    "text-xs text-muted-foreground",
                    className ?? "",
                ].join(" ")}
            >
                <CloudOff size={12} aria-hidden="true" />
                <span>{title}</span>
            </div>
        );
    }

    return (
        <div
            role="status"
            aria-live="polite"
            className={[
                "mx-auto max-w-md rounded-lg border border-dashed border-border bg-muted/30",
                "px-5 py-8 text-center flex flex-col items-center gap-2",
                className ?? "",
            ].join(" ")}
        >
            <CloudOff
                size={20}
                className="text-muted-foreground/60"
                aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">{title}</p>
            {subtitle ? (
                <p className="text-xs text-muted-foreground/80 leading-snug">
                    {subtitle}
                </p>
            ) : null}
            {action ? <div className="mt-1">{action}</div> : null}
        </div>
    );
}
