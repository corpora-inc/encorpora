import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { LanguageSelectOrder } from "./LanguageSelectOrder";
import { DomainPicker } from "./DomainPicker";
import { LevelsPicker } from "./LevelsPicker";

// Use the built-in modal with correct sizing
export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    return (
        <Dialog open={open} onOpenChange={onClose}

        >

            <DialogContent
                className={`
          max-w-full w-[100vw] sm:w-[90vw]
          max-h-[100vh] h-[100vh] sm:h-auto
          overflow-y-auto p-4 sm:p-8
          rounded-none sm:rounded-xl
          bg-white
        `}

            >
                <DialogTitle>Settings</DialogTitle>
                <DialogDescription>Adjust to your preferences</DialogDescription>
                <LanguageSelectOrder />
                <LevelsPicker />
                <DomainPicker />
            </DialogContent>
        </Dialog>
    );
}
