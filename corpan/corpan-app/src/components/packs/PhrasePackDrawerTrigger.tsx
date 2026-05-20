// src/components/packs/PhrasePackDrawerTrigger.tsx
//
// The single shared trigger for the phrase-pack drawer. Same component
// dropped into the Stacks tab (inside PhrasePackToggleSection) and the
// Packs tab (inside PacksListing). Owns the visual treatment, the
// count badge, the icon, and the call into the drawer store.
//
// Self-hides when the catalog has zero phrase packs — keeps the
// owning panes from showing a button that goes nowhere on a fresh
// install or while the catalog is still loading offline.

import { useTranslation } from "react-i18next"
import { ChevronRight, Library } from "lucide-react"

import { Button } from "@/components/ui/button"
import { usePhrasePackCatalog } from "@/hooks/usePhrasePackCatalog"
import { useDrawerStore } from "@/store/drawer"

export function PhrasePackDrawerTrigger() {
    const { t } = useTranslation()
    const { allPhrasePacks } = usePhrasePackCatalog()
    const openPhrasePacks = useDrawerStore((s) => s.openPhrasePacks)

    if (allPhrasePacks.length === 0) return null

    return (
        // Full-width hero CTA. Matches the "Reconfigure stack" /
        // "Open TTS settings" sizing convention (full-width, tall via
        // px-6 py-8) so all three live-action buttons in the
        // Stacks/Packs tabs have a consistent presence. `h-auto`
        // overrides the Button's default fixed height so our padding
        // drives the size. Purple-tinted outline + hover keep the
        // phrase-pack visual identity.
        <Button
            type="button"
            variant="outline"
            onClick={openPhrasePacks}
            className="
                w-full h-auto rounded-md px-6 py-8 gap-3
                border-purple-400/30 bg-purple-500/[0.02]
                hover:border-purple-400/70 hover:bg-purple-500/[0.06]
                shadow-sm group
            "
        >
            <Library
                size={18}
                className="text-purple-500 shrink-0"
                aria-hidden="true"
            />
            <span className="flex-1 text-start font-medium truncate">
                {t("packs.phrasePack.openDrawerLabel", {
                    defaultValue: "Browse phrase packs",
                })}
            </span>
            <span className="inline-flex items-center gap-2 shrink-0">
                <span className="text-xs font-semibold tabular-nums text-purple-600 bg-purple-500/[0.1] rounded-full px-2 py-0.5">
                    {allPhrasePacks.length}
                </span>
                <ChevronRight
                    size={16}
                    className="text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                />
            </span>
        </Button>
    )
}
