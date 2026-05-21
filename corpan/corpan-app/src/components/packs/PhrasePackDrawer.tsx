// src/components/packs/PhrasePackDrawer.tsx
//
// App-root phrase-pack manager drawer. Mounted once at App.tsx level as
// a sibling of SettingsModal so its Vaul `Root` lives OUTSIDE the
// modal's scrolling container — keeps Vaul's touch handlers from
// hijacking parent scroll on iOS WKWebView (the bug that broke Stacks
// tab scroll when this lived inside PacksListing).
//
// Triggered via `useDrawerStore.openPhrasePacks()` from any pane. Today:
// Stacks tab `PhrasePackToggleSection` and Packs tab `PacksListing`,
// both via the shared `<PhrasePackDrawerTrigger />` component.

import { useTranslation } from "react-i18next"
import { Library } from "lucide-react"

import {
    Drawer,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from "@/components/ui/drawer"
import { useDrawerStore } from "@/store/drawer"
import { PhrasePackBrowser } from "./PhrasePackBrowser"

export function PhrasePackDrawer() {
    const { t } = useTranslation()
    const open = useDrawerStore((s) => s.phrasePackOpen)
    const setOpen = useDrawerStore((s) => s.setPhrasePackOpen)

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            {/* Height: phones at 90vh — a ~10vh (~80px) peek at the
             *  top gives the user a real grab target to dismiss the
             *  sheet by tapping the dimmed background, on top of the
             *  grab handle itself. 95vh was too tight to comfortably
             *  hit. iPad caps at 80vh; on a 12.9" screen the room is
             *  plentiful and the smaller sheet reads cleaner.
             *
             *  Header is hidden on phones — the search placeholder
             *  ("Search phrase packs") + the trigger that opened the
             *  drawer carry identity, the title row would just eat
             *  ~52px of vertical real estate.
             *
             *  Important overrides: the shared `drawer.tsx` baseline
             *  has `mt-24` (96px top margin) and `max-h-[80vh]` baked
             *  in for bottom drawers, both of which would otherwise
             *  clamp us back to ~80vh starting 96px below the screen
             *  top. We override `mt-24` with `!` to win the cascade
             *  without touching the shared primitive (which other
             *  drawers may rely on). */}
            <DrawerContent className="!mt-2 !max-h-[90vh] h-[90vh] md:!max-h-[80vh] md:h-[80vh]">
                <div className="hidden md:block">
                    <DrawerHeader className="pb-2">
                        <DrawerTitle className="flex items-center justify-center gap-1.5 text-base">
                            <Library
                                size={16}
                                className="text-muted-foreground/80"
                                aria-hidden="true"
                            />
                            {t("packs.phrasePack.sectionTitle", {
                                defaultValue: "Phrase packs",
                            })}
                        </DrawerTitle>
                    </DrawerHeader>
                </div>
                <PhrasePackBrowser />
            </DrawerContent>
        </Drawer>
    )
}
