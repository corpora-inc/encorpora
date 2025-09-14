// src/components/StacksManagerDeletePopover.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
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
    const rootRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!rootRef.current) return;
            if (!rootRef.current.contains(target)) setOpen(false);
        };
        document.addEventListener("mousedown", onDown, true);
        return () => document.removeEventListener("mousedown", onDown, true);
    }, [open, setOpen]);

    return (
        <div ref={rootRef} className="relative">
            <Button
                type="button"
                className="rounded-xl cursor-pointer"
                size="sm"
                variant="outline"
                disabled={!canDelete}
                title={t("stacks.delete", { defaultValue: "Delete stack" }) as string}
                onClick={() => {
                    if (!canDelete) return;
                    setOpen(!open);
                }}
            >
                <Trash2 className="h-4 w-4" />
            </Button>

            {open && (
                <div className="absolute right-0 top-full z-[1000] mt-2 w-[260px] rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-md">
                    <div className="space-y-2">
                        <div className="text-sm font-medium">
                            {t("stacks.confirmDeleteTitle", {
                                defaultValue: "Delete this stack?",
                            }) as string}
                        </div>
                        <div className="text-xs text-gray-500">
                            {t("stacks.confirmDelete", {
                                defaultValue: activeName
                                    ? `Delete stack “${activeName}”? This cannot be undone.`
                                    : "Delete this stack? This cannot be undone.",
                            }) as string}
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <Button
                                size="sm"
                                variant="outline"
                                className="cursor-pointer"
                                onClick={() => setOpen(false)}
                            >
                                {t("common.cancel", { defaultValue: "Cancel" }) as string}
                            </Button>
                            <Button
                                size="sm"
                                variant="destructive"
                                className="cursor-pointer"
                                onClick={() => {
                                    onConfirm();
                                    setOpen(false);
                                }}
                            >
                                {t("common.delete", { defaultValue: "Delete" }) as string}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
