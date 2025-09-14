// src/components/StacksManager.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useSettingsStore } from "@/store/settings";
import { Button } from "@/components/ui/button";
import { Plus, Copy, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function StacksManager() {
    const { t } = useTranslation();

    // Canonical state
    const stacks = useSettingsStore((s) => s.stacks);
    const activeId = useSettingsStore((s) => s.activeStackId);

    // Actions
    const setActiveStack = useSettingsStore((s) => s.setActiveStack);
    const createStack = useSettingsStore((s) => s.createStack);
    const renameStack = useSettingsStore((s) => s.renameStack);
    const deleteStack = useSettingsStore((s) => s.deleteStack);

    // Derived
    const stacksList = useMemo(
        () =>
            Object.values(stacks).map(({ id, name }) => ({
                id,
                name,
            })),
        [stacks]
    );

    const active = stacks[activeId];
    const [nameDraft, setNameDraft] = useState(active?.name ?? "");
    const nameInputRef = useRef<HTMLInputElement>(null);

    // Keep local draft in sync when active stack changes
    useEffect(() => {
        setNameDraft(active?.name ?? "");
    }, [activeId, active?.name]);

    const onCommitRename = () => {
        const trimmed = nameDraft.trim();
        if (!active) return;
        if (trimmed && trimmed !== active.name) {
            renameStack(active.id, trimmed);
        } else {
            // reset visual draft if unchanged/empty
            setNameDraft(active.name);
        }
    };

    const onCreateNew = () => {
        // Create a new stack by cloning current (store handles default name/clone)
        const newId = createStack(); // clones active, name like "<name> copy"
        setActiveStack(newId);
        // focus name field for immediate rename
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const onDuplicate = () => {
        if (!active) return;
        const newId = createStack(undefined, active.id);
        setActiveStack(newId);
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const onDelete = () => {
        if (!active) return;
        if (stacksList.length <= 1) return;
        const ok =
            typeof window !== "undefined"
                ? window.confirm(
                    t("stacks.confirmDelete", {
                        defaultValue: `Delete stack "${active.name}"? This cannot be undone.`,
                    }) as string
                )
                : true;
        if (ok) deleteStack(active.id);
    };

    return (
        <div className="mb-4 rounded-xl border border-gray-200 bg-white/80 p-3 md:p-4">
            <div className="flex flex-col gap-3 md:gap-4">
                {/* Row: Stack select + name edit */}
                <div className="flex flex-col md:flex-row md:items-center gap-2">
                    <label className="text-sm text-gray-600">
                        {t("stacks.current", { defaultValue: "Current stack" })}
                    </label>
                    <div className="flex w-full gap-2 md:items-center">
                        <select
                            className="w-48 md:w-60 rounded-md border border-gray-300 bg-white px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                            value={activeId}
                            onChange={(e) => setActiveStack(e.target.value)}
                        >
                            {stacksList.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.name}
                                </option>
                            ))}
                        </select>

                        <input
                            ref={nameInputRef}
                            type="text"
                            className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                            value={nameDraft}
                            onChange={(e) => setNameDraft(e.target.value)}
                            onBlur={onCommitRename}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.currentTarget.blur();
                                } else if (e.key === "Escape" && active) {
                                    setNameDraft(active.name);
                                    e.currentTarget.blur();
                                }
                            }}
                            placeholder={t("stacks.namePlaceholder", {
                                defaultValue: "Name this stack…",
                            }) as string}
                            aria-label={t("stacks.nameAria", { defaultValue: "Stack name" }) as string}
                        />
                    </div>
                </div>

                {/* Row: actions */}
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        type="button"
                        onClick={onCreateNew}
                        className="rounded-lg"
                        variant="outline"
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        {t("stacks.new", { defaultValue: "New" })}
                    </Button>

                    <Button
                        type="button"
                        onClick={onDuplicate}
                        className="rounded-lg"
                        variant="outline"
                        disabled={!active}
                    >
                        <Copy className="mr-1 h-4 w-4" />
                        {t("stacks.duplicate", { defaultValue: "Duplicate" })}
                    </Button>

                    <Button
                        type="button"
                        onClick={onDelete}
                        className="rounded-lg"
                        variant="outline"
                        disabled={!active || stacksList.length <= 1}
                    >
                        <Trash2 className="mr-1 h-4 w-4" />
                        {t("stacks.delete", { defaultValue: "Delete" })}
                    </Button>
                </div>

                {/* Note */}
                <p className="text-xs text-gray-500">
                    {t("stacks.note", {
                        defaultValue:
                            "Each stack has its own settings and history. Switching stacks changes both.",
                    })}
                </p>
            </div>
        </div>
    );
}

export default StacksManager;
