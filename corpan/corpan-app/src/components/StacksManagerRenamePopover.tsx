import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RefObject } from "react";

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
    inputRef: RefObject<HTMLInputElement>;
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
                    title={t("stacks.rename", { defaultValue: "Rename" }) as string}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent containerId="settings-modal-content" align="start" className="w-[240px] p-3">
                <div className="space-y-2">
                    <label className="text-xs text-gray-500">
                        {t("stacks.renameLabel", { defaultValue: "Stack name" }) as string}
                    </label>
                    <input
                        ref={inputRef}
                        type="text"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                        value={nameDraft}
                        onChange={(e) => onChange(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === "Escape") setOpen(false);
                        }}
                        autoFocus
                    />
                    <div className="flex justify-end">
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
                            {t("common.done", { defaultValue: "Done" }) as string}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
