import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { RefObject } from "react";

export default function StacksManagerRenameInline({
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
    if (!open) return null;
    return (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
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
        </div>
    );
}
