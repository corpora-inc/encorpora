// src/components/StacksManagerDeletePopover.tsx
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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
    const triggerWrapRef = useRef<HTMLSpanElement>(null);

    const confirmAndClose = () => {
        onConfirm();
        setOpen(false);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <span ref={triggerWrapRef} className="inline-flex">
                    <Button
                        type="button"
                        className="rounded-md cursor-pointer"
                        size="sm"
                        variant="outline"
                        disabled={!canDelete}
                        title={t("stacks.delete", { defaultValue: "Delete stack" }) as string}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </span>
            </PopoverTrigger>

            <PopoverContent
                containerId="settings-modal-content"
                side="bottom"
                align="center"
                sideOffset={8}
                // Default width/cap; expand to near-full width on very small screens
                className="w-[260px] max-w-[92vw] max-[480px]:w-[calc(100vw-24px)] max-[480px]:max-w-none"
                onEscapeKeyDown={() => setOpen(false)}
                onPointerDownOutside={() => setOpen(false)}
                // Prevent focus auto-moves that can cause scroll jumps on mobile
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
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
                        <Button size="sm" variant="destructive" className="cursor-pointer" onClick={confirmAndClose}>
                            {t("common.delete", { defaultValue: "Delete" }) as string}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
