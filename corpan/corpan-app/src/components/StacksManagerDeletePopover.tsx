import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function StacksManagerDeletePopover({
    open,
    setOpen,
    canDelete,
    activeName,
    onConfirm,
}: {
    open: boolean;
    setOpen: (b: boolean) => void;
    canDelete: boolean;
    activeName?: string;
    onConfirm: () => void;
}) {
    const { t } = useTranslation();
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    className="rounded-xl cursor-pointer"
                    size="sm"
                    variant="outline"
                    disabled={!canDelete}
                    title={t("stacks.delete", { defaultValue: "Delete stack" }) as string}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent containerId="settings-modal-content" align="end" className="w-[260px] p-3">
                <div className="space-y-2">
                    <div className="text-sm font-medium">
                        {t("stacks.confirmDeleteTitle", { defaultValue: "Delete this stack?" }) as string}
                    </div>
                    <div className="text-xs text-gray-500">
                        {t("stacks.confirmDelete", {
                            defaultValue: activeName
                                ? `Delete stack “${activeName}”? This cannot be undone.`
                                : "Delete this stack? This cannot be undone.",
                        }) as string}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
                            {t("common.cancel", { defaultValue: "Cancel" }) as string}
                        </Button>
                        <Button size="sm" variant="destructive" className="cursor-pointer" onClick={onConfirm}>
                            {t("common.delete", { defaultValue: "Delete" }) as string}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
