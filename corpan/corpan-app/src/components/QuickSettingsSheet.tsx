// src/components/QuickSettingsSheet.tsx
//
// A compact settings sheet reachable from INSIDE any pack (a gear in the pack
// chrome) and from the host API (`hostApi.openQuickSettings`). Surfaces the
// most-changed controls — speed, languages, levels, active phrase packs — so a
// user practicing in (say) Parlometron can retune without exiting. Every
// control writes the active stack in `store/settings.ts`, which notifies the
// running pack live via `hostApi.onStackConfigChange`; no extra wiring.
//
// Mounted once at App root (sibling of SettingsModal / PhrasePackDrawer). The
// vaul Drawer is z-[1200], above the pack overlay (z-1100) and chrome (z-1110).

import { useTranslation } from "react-i18next"
import { SlidersHorizontal, ExternalLink } from "lucide-react"

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useDrawerStore } from "@/store/drawer"
import { RateAdjuster } from "./RateAdjuster"
import { TextSizeAdjuster } from "./TextSizeAdjuster"
import { LanguageSelectOrder } from "./LanguageSelectOrder"
import { LevelsPicker } from "./LevelsPicker"
import { PhrasePackToggleSection } from "./packs/PhrasePackToggleSection"
import { Button } from "./ui/button"

export function QuickSettingsSheet() {
  const { t } = useTranslation()
  const open = useDrawerStore((s) => s.quickSettingsOpen)
  const setOpen = useDrawerStore((s) => s.setQuickSettingsOpen)

  const openFullSettings = () => {
    setOpen(false)
    // Open the full Settings modal OVER the running pack (App listens). The
    // pack keeps running underneath — we never dispatch corpan:exit here.
    window.dispatchEvent(new CustomEvent("corpan:open-settings"))
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerContent className="!mt-2 !max-h-[90vh] h-[90vh] md:!max-h-[80vh] md:h-[80vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="flex items-center justify-center gap-1.5 text-base">
            <SlidersHorizontal size={16} className="text-muted-foreground/80" aria-hidden="true" />
            {t("quickSettings.title", { defaultValue: "Quick settings" })}
          </DrawerTitle>
        </DrawerHeader>

        {/* Center + cap width at >= md so the controls don't stretch
            edge-to-edge on the full-width iPad/desktop drawer; roomier
            spacing/padding there, compact on phones. */}
        <div className="flex-1 space-y-4 md:space-y-6 overflow-y-auto px-4 md:px-6 pb-10 w-full md:max-w-2xl md:mx-auto">
          <RateAdjuster />
          <TextSizeAdjuster />
          <LanguageSelectOrder />
          <LevelsPicker />
          <PhrasePackToggleSection />

          <Button variant="outline" className="w-full" data-testid="quick-full-settings" onClick={openFullSettings}>
            <ExternalLink className="mr-2 h-4 w-4" />
            {t("quickSettings.fullSettings", { defaultValue: "Full settings" })}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
