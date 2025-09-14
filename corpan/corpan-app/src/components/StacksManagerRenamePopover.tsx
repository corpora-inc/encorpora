// src/components/StacksManagerRenamePopover.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function StacksManagerRenamePopover({
    open,
    setOpen,
    nameDraft,
    onChange,
    inputRef,
}: {
    open: boolean;
    setOpen: (b: boolean) => void;
    nameDraft: string;
    onChange: (next: string) => void;
    inputRef: React.RefObject<HTMLInputElement>;
}) {
    const { t } = useTranslation();
    const rootRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!rootRef.current) return;
            if (!rootRef.current.contains(target)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDown, true);
        return () => document.removeEventListener("mousedown", onDown, true);
    }, [open, setOpen]);

    // Focus the input when opening
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => inputRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [open, inputRef]);

    return (
        <div ref={rootRef} className="relative">
            <Button
                type="button"
                className="rounded-xl cursor-pointer"
                size="sm"
                variant="outline"
                title={t("stacks.rename", { defaultValue: "Rename" }) as string}
                onClick={() => setOpen(!open)}
            >
                <Pencil className="h-4 w-4" />
            </Button>

            {open && (
                <div
                    ref={panelRef}
                    className="absolute right-0 top-full z-[1000] mt-2 w-[260px] rounded-xl border border-gray-200 bg-white p-3 text-gray-900 shadow-md"
                >
                    <div className="space-y-2">
                        <input
                            ref={inputRef}
                            type="text"
                            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                            value={nameDraft}
                            onChange={(e) => onChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Escape") setOpen(false);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
