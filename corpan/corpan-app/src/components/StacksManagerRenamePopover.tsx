// src/components/StacksManagerRenamePopover.tsx
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

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
    const triggerWrapRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() =>
            inputRef.current?.focus({ preventScroll: true })
        );
        return () => cancelAnimationFrame(id);
    }, [open, inputRef]);

    const closeCleanly = () => {
        // Dismiss keyboard first to avoid scroll jumps on mobile
        inputRef.current?.blur();
        requestAnimationFrame(() => setOpen(false));
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
                        title={t("stacks.rename", { defaultValue: "Rename" }) as string}
                    >
                        <Pencil className="h-4 w-4" />
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
                // Prevent focus auto-moves that can cause scroll jumps on mobile
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault(); // avoid implicit submit/scroll on Enter
                        closeCleanly();
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full rounded-md border px-3 py-1.5 text-sm outline-none focus:ring-2 0"
                        value={nameDraft}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                e.preventDefault();
                                closeCleanly();
                            }
                        }}
                        placeholder={t("stacks.renameLabel", { defaultValue: "Stack name" }) as string}
                        inputMode="text"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                </form>
            </PopoverContent>
        </Popover>
    );
}
