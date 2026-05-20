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
            <DrawerContent className="h-[85vh] max-h-[85vh]">
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
                <PhrasePackBrowser />
            </DrawerContent>
        </Drawer>
    )
}
