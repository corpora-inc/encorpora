// encorpora/corpan/corpan-app/src/components/TTSSettingsDrawer.tsx
//
// The in-Settings home for voice tuning. Opened from the Settings modal
// (JumpToTTSButton) so the user can re-pick / re-tune voices IN PLACE —
// without re-walking onboarding. Hosts the shared <TTSVoicePicker> (the same
// component first-run onboarding uses), so the two never drift.
//
// Why a vaul Drawer and not the old full-screen onboarding overlay: the old
// overlay rendered an `OnboardingShell` (a bare `fixed inset-0` panel) as a
// sibling of the OPEN Settings Radix dialog. Radix locks `pointer-events` on
// the body while a dialog is open, so that overlay's Continue/Back became
// unclickable — the user was trapped and had to force-quit. vaul's drawer
// (z-[1200], above our Dialog's z-[1100]) is built to open from inside a
// dialog and stays interactive; scrim-tap / swipe-down / the × all dismiss it.
//
// Voice selections persist live to the settings store, so there's no "save" —
// closing the drawer keeps the choices.
import { XIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerTitle,
} from "@/components/ui/drawer";
import { useDrawerStore } from "@/store/drawer";
import { useSettingsStore } from "@/store/settings";
import { TTSVoicePicker } from "./TTSVoicePicker";

export function TTSSettingsDrawer() {
    const { t } = useTranslation();
    const dir = useSettingsStore((s) => s.dir);
    const open = useDrawerStore((s) => s.ttsSettingsOpen);
    const setOpen = useDrawerStore((s) => s.setTTSSettingsOpen);

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            <DrawerContent
                // Tall sheet with its own internal scroll: the power-user grid
                // can run long. Capped under the viewport so the drag handle +
                // scrim stay reachable on a short phone.
                className="max-h-[92dvh]"
                dir={dir()}
            >
                {/* The visible heading/intro live INSIDE TTSVoicePicker (shared
                    with onboarding); these satisfy vaul's a11y title/description
                    requirement without duplicating that copy on screen. */}
                <DrawerTitle className="sr-only">
                    {t("onboarding.textToSpeechSetup", { defaultValue: "Text-to-speech setup" })}
                </DrawerTitle>
                <DrawerDescription className="sr-only">
                    {t("onboarding.ttsIntro", {
                        defaultValue: "Corpán reads aloud. Tap a voice to hear it at your speed.",
                    })}
                </DrawerDescription>

                <DrawerClose
                    aria-label="Close"
                    className="absolute end-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background shadow-sm cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                    <XIcon className="h-5 w-5" />
                </DrawerClose>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1rem)] pt-6">
                    <div className="mx-auto flex w-full max-w-3xl flex-col items-center">
                        {/* Rescue-card "Skip" closes the drawer here (no graph to advance). */}
                        <TTSVoicePicker onSkip={() => setOpen(false)} />
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    );
}
