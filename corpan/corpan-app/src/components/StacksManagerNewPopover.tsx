// src/components/StacksManagerNewPopover.tsx
import { useEffect, useRef } from "react";
import { flushSync } from "react-dom";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

const FUN_CHARS = ["★", "☆", "✦", "✧", "◆", "◇", "◈", "⬢", "⬡", "♠", "♥", "♦", "♣", "☀", "☾", "☽", "☼", "✿", "❀", "❁", "⚝"];
const randomGlyphs = (n = 3) => Array.from({ length: n }, () => FUN_CHARS[(Math.random() * FUN_CHARS.length) | 0]).join("");

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

    // Focus input when opening
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
        return () => cancelAnimationFrame(id);
    }, [open]);

    const commitCreate = () => {
        const final = newName.trim() || randomGlyphs(3);
        flushSync(() => setNewName(final));
        onCreate();

        // Important on mobile: blur before closing so focus doesn't snap
        // back to the trigger (which can scroll the viewport).
        inputRef.current?.blur();

        // Defer close to next frame to let keyboard dismiss settle first.
        requestAnimationFrame(() => {
            setOpen(false);
        });
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <span
                    ref={triggerWrapRef}
                    className="inline-flex"
                    onClick={() => {
                        if (!open) setNewName(""); // start truly blank each time we open
                    }}
                >
                    <Button
                        type="button"
                        className="rounded-md cursor-pointer"
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
                // className="w-[260px] max-w-[92vw]"
                className="w-[260px] max-w-[92vw] max-[480px]:w-[calc(100vw-24px)] max-[480px]:max-w-none"

                // Prevent Radix from auto-focusing the content on open or
                // returning focus to the trigger on close (both can scroll).
                onOpenAutoFocus={(e) => e.preventDefault()}
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <form
                    onSubmit={(e) => {
                        e.preventDefault(); // stop implicit submit/scroll behavior
                        commitCreate();
                    }}
                >
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full rounded-md border  px-3 py-1.5 text-sm outline-none focus:ring-2 "
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            // Let form handle Enter; still close on Escape.
                            if (e.key === "Escape") {
                                e.preventDefault();
                                inputRef.current?.blur();
                                // Prevent Radix from snapping focus back to trigger
                                requestAnimationFrame(() => setOpen(false));
                            }
                        }}
                        placeholder={t("stacks.newName", { defaultValue: "Name for new stack" }) as string}
                        inputMode="text"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck={false}
                    />
                    <div className="mt-2 flex justify-end">
                        <Button size="sm" className="cursor-pointer" type="submit">
                            {t("common.create", { defaultValue: "Create" }) as string}
                        </Button>
                    </div>
                </form>
            </PopoverContent>
        </Popover>
    );
}
