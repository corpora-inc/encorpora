// src/components/StacksManager.tsx
// Condensed toolbar, shadcn Select, instant rename, nicer duplicate naming.

import { useEffect, useMemo, useRef, useState } from "react";
import { useSettingsStore } from "@/store/settings";
import { Button } from "@/components/ui/button";
import { Plus, Copy, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    Select,
    SelectTrigger,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectValue,
} from "@/components/ui/select";

function nextCopyName(base: string, existing: string[]): string {
    // If "Romance" exists, make "Romance 2", then "Romance 3", etc.
    const regex = new RegExp(`^${base}(?:\\s(\\d+))?$`);
    const nums = existing
        .map((n) => {
            const m = n.match(regex);
            return m ? Number(m[1] || 1) : null;
        })
        .filter((x): x is number => x !== null);
    const max = nums.length ? Math.max(...nums) : 1;
    return `${base} ${max + 1}`;
}

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
        () => Object.values(stacks).map(({ id, name }) => ({ id, name })),
        [stacks]
    );
    const active = stacks[activeId];

    // Local drafting (still write through immediately)
    const [nameDraft, setNameDraft] = useState(active?.name ?? "");
    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setNameDraft(active?.name ?? "");
    }, [activeId, active?.name]);

    // Instant write-through rename with gentle coercion to "Untitled" on empty
    const handleNameInput = (val: string) => {
        setNameDraft(val);
        const trimmed = val.trim();
        if (!active) return;
        renameStack(active.id, trimmed.length ? trimmed : t("stacks.untitled", { defaultValue: "Untitled" }) as string);
    };

    const onCreateNew = () => {
        // Create by cloning active, then immediately rename to "New Stack" (or "New Stack 2" ...)
        const newId = createStack();
        const existingNames = stacksList.map((s) => s.name);
        const base = t("stacks.newStackBase", { defaultValue: "New Stack" }) as string;
        const newName = existingNames.includes(base) ? nextCopyName(base, existingNames) : base;
        renameStack(newId, newName);
        setActiveStack(newId);
        setTimeout(() => nameInputRef.current?.focus(), 0);
    };

    const onDuplicate = () => {
        if (!active) return;
        const newId = createStack(undefined, active.id);
        const existingNames = stacksList.map((s) => s.name);
        const newName = nextCopyName(active.name, existingNames);
        renameStack(newId, newName);
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
        <div className="mb-2 rounded-lg border border-gray-200 bg-white/80 p-2 md:p-3">
            <div className="flex flex-col gap-2">
                {/* Compact toolbar row */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs text-gray-600 min-w-[80px]">
                        {t("stacks.current", { defaultValue: "Stack" })}
                    </div>

                    {/* shadcn Select */}
                    <div className="w-[220px] md:w-[260px]">
                        <Select value={activeId} onValueChange={(v) => setActiveStack(v)}>
                            <SelectTrigger aria-label={t("stacks.selectAria", { defaultValue: "Select a stack" }) as string}>
                                <SelectValue placeholder={t("stacks.selectPlaceholder", { defaultValue: "Choose…" }) as string} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    {stacksList.map((s) => (
                                        <SelectItem key={s.id} value={s.id}>
                                            {/* If editing, reflect live draft name for the active item */}
                                            {s.id === activeId ? nameDraft || s.name : s.name}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Inline name editor (instant write-through) */}
                    <input
                        ref={nameInputRef}
                        type="text"
                        className="flex-1 min-w-[160px] rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-400"
                        value={nameDraft}
                        onChange={(e) => handleNameInput(e.target.value)}
                        placeholder={
                            t("stacks.namePlaceholder", { defaultValue: "Name this stack…" }) as string
                        }
                        aria-label={t("stacks.nameAria", { defaultValue: "Stack name" }) as string}
                    />

                    <div className="ml-auto flex items-center gap-1">
                        <Button
                            type="button"
                            onClick={onCreateNew}
                            className="rounded-lg"
                            size="sm"
                            variant="outline"
                            title={t("stacks.new", { defaultValue: "New" }) as string}
                        >
                            <Plus className="h-4 w-4" />
                        </Button>

                        <Button
                            type="button"
                            onClick={onDuplicate}
                            className="rounded-lg"
                            size="sm"
                            variant="outline"
                            disabled={!active}
                            title={t("stacks.duplicate", { defaultValue: "Duplicate" }) as string}
                        >
                            <Copy className="h-4 w-4" />
                        </Button>

                        <Button
                            type="button"
                            onClick={onDelete}
                            className="rounded-lg"
                            size="sm"
                            variant="outline"
                            disabled={!active || stacksList.length <= 1}
                            title={t("stacks.delete", { defaultValue: "Delete" }) as string}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                {/* Tiny helper note (compressed) */}
                <p className="text-[11px] text-gray-500">
                    {t("stacks.note", {
                        defaultValue: "Each stack has its own settings and history.",
                    })}
                </p>
            </div>
        </div>
    );
}

export default StacksManager;
