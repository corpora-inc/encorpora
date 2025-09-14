import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
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
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    className="rounded-xl cursor-pointer"
                    size="sm"
                    variant="outline"
                    title={t("stacks.new", { defaultValue: "New stack" }) as string}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent containerId="settings-modal-content" align="end" className="w-[260px] p-3">
                <div className="space-y-2">
                    <label className="text-xs text-gray-500">
                        {t("stacks.newName", { defaultValue: "Name for new stack" }) as string}
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-xl border border-gray-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") onCreate();
                            if (e.key === "Escape") setOpen(false);
                        }}
                        autoFocus
                    />
                    <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" className="cursor-pointer" onClick={() => setOpen(false)}>
                            {t("common.cancel", { defaultValue: "Cancel" }) as string}
                        </Button>
                        <Button size="sm" className="cursor-pointer" onClick={onCreate}>
                            {t("common.create", { defaultValue: "Create" }) as string}
                        </Button>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
