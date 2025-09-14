// src/components/StacksManagerNewPopover.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

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
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

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

    // Focus the input when opening
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [open]);

    return (
        <div ref={rootRef} className="relative">
            <Button
                type="button"
                className="rounded-xl cursor-pointer"
                size="sm"
                variant="outline"
                title={t("stacks.new", { defaultValue: "New stack" }) as string}
                onClick={() => setOpen(!open)}
            >
                <Plus className="h-4 w-4" />
            </Button>

            {open && (
                <div className="absolute right-0 top-full z-[1000] mt-2 w-[260px] rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-md">
                    <div className="space-y-2">
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
                            placeholder={t("stacks.newName", {
                                defaultValue: "Name for new stack",
                            }) as string}
                        />
                        <div className="flex justify-end gap-2 pt-1">
                            <Button
                                size="sm"
                                className="cursor-pointer"
                                onClick={onCreate}
                            >
                                {t("common.create", { defaultValue: "Create" }) as string}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
