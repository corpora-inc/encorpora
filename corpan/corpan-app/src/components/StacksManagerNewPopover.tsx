// src/components/StacksManagerNewPopover.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export default function StacksManagerNewPopover({
    open,
    setOpen,
    newName,
    setNewName,
    onCreate,
}: {
    open: boolean;
    setOpen: (b: boolean) => void;
    newName: string;
    setNewName: (s: string) => void;
    onCreate: () => void;
}) {
    const { t } = useTranslation();
    const triggerWrapRef = useRef<HTMLSpanElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [open]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <span ref={triggerWrapRef} className="inline-flex">
                    <Button
                        type="button"
                        className="rounded-xl cursor-pointer"
                        size="sm"
                        variant="outline"
                        title={t("stacks.new", { defaultValue: "New stack" }) as string}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </span>
            </PopoverTrigger>

            <PopoverContent
                containerId="settings-modal-content"
                side="bottom"
                align="center"
                sideOffset={8}
                className="w-[260px] max-w-[92vw]"
            >
                <input
                    ref={inputRef}
                    type="text"
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") onCreate();
                        if (e.key === "Escape") setOpen(false);
                    }}
                    placeholder={
                        t("stacks.newName", { defaultValue: "Name for new stack" }) as string
                    }
                />
                <div className="mt-2 flex justify-end">
                    <Button
                        size="sm"
                        className="cursor-pointer"
                        onClick={() => {
                            onCreate();
                            setOpen(false);
                        }}
                    >
                        {t("common.create", { defaultValue: "Create" }) as string}
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    );
}
