import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelectOrder } from "./LanguageSelectOrder";
import { DomainPicker } from "./DomainPicker";
import { LevelsPicker } from "./LevelsPicker";
import { RateAdjuster } from "./RateAdjuster";
import { RomanizationToggle } from "./RomanizationToggle";

import { useSettingsStore } from "@/store/settings";
import { Button } from "./ui/button";
import { TextSizeAdjuster } from "./TextSizeAdjuster";
import About from "./About";
import { Separator } from "./ui/separator";

// Use the built-in modal with correct sizing
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {

    const dir = useSettingsStore((s) => s.dir);
    const t = useSettingsStore((s) => s.t);
    const topLang = useSettingsStore((s) => s.topLang());
    const setOnboarded = useSettingsStore((s) => s.setOnboarded);
    const setOnboardingStep = useSettingsStore((s) => s.setOnboardingStep);
    console.log("new topLang", topLang);

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent
                className="
                    max-w-full w-[100vw] sm:max-w-[100vw] md:max-w-[90vw] lg:max-w-[75vw] xl:max-w-[60vw]
                    max-h-[100dvh] h-[100dvh] md:h-auto md:max-h-[95dvh]
                    overflow-y-auto rounded-none bg-white
                    md:rounded-lg
                    flex flex-col
                "
                style={{
                    paddingBottom: "2rem",
                    paddingTop: "3rem",
                }}
                id="settings-modal-content"
            >
                <DialogTitle dir={dir()}>
                    {t("Settings")}
                </DialogTitle>
                <DialogDescription dir={dir()}>
                    {t("Adjust to your preferences")}
                </DialogDescription>
                
                <div className="flex-1 overflow-hidden ">
                    <div className="h-full overflow-y-auto px-1 space-y-4">
                        <TextSizeAdjuster />
                        <RateAdjuster />
                        <LanguageSelectOrder />
                        <LevelsPicker />
                        <DomainPicker />
                        <RomanizationToggle />
                        <Button
                            onClick={() => {
                                setOnboarded(false);
                                setOnboardingStep(0);
                                onClose();
                            }}
                            className="
                                mt-5 w-full rounded-xl px-6 py-8
                                focus:outline-none focus:ring-2 focus:ring-neutral-400 focus:ring-offset-2
                                transition-colors cursor-pointer
                                shadow-sm
                            "
                        >
                            {t("reonboard")}
                        </Button>
                        <Separator className="mt-5" />
                        <div className="space-y-1 my-5">
                            <h4 className="text-2xl leading-none font-medium text-center">{t("About Corpán" as any)}</h4>
                            <p className="text-muted-foreground text-center">{t("Instant polyglot practice" as any)}</p>
                        </div>
                        <About />
                    </div>
                </div>

            </DialogContent>
        </Dialog>
    );
}
