import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelectOrder } from "./LanguageSelectOrder";
import { DomainPicker } from "./DomainPicker";
import { LevelsPicker } from "./LevelsPicker";
import { RateAdjuster } from "./RateAdjuster";
import { useSettingsStore } from "@/store/settings";
import { Button } from "./ui/button";

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
                <RateAdjuster />
                <LanguageSelectOrder />
                <LevelsPicker />
                <DomainPicker />
                <Button
                    onClick={() => {
                        setOnboarded(false);
                        setOnboardingStep(0);
                        onClose();
                    }}
                >
                    {t("reonboard")}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
