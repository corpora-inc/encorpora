import { Dialog, DialogContent } from "@/components/ui/dialog";
import { LanguageSelectOrder } from "./LanguageSelectOrder";

export function SettingsModal({
    open,
    onClose,
}: {
    open: boolean;
    onClose: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent>
                <h2 className="text-xl font-semibold mb-2">Settings</h2>
                <LanguageSelectOrder />
            </DialogContent>
        </Dialog>
    );
}
