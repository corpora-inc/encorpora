import { useEffect, useMemo, useRef, useState } from "react";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "react-i18next";
import { nextCopyName } from "./StacksManager.utils";
import StacksManagerSelect from "./StacksManagerSelect";
import StacksManagerRenamePopover from "./StacksManagerRenamePopover";
import StacksManagerNewPopover from "./StacksManagerNewPopover";
import StacksManagerDeletePopover from "./StacksManagerDeletePopover";

export function StacksManager() {
    const { t } = useTranslation();

    const stacks = useSettingsStore((s) => s.stacks);
    const activeId = useSettingsStore((s) => s.activeStackId);

    const setActiveStack = useSettingsStore((s) => s.setActiveStack);
    const createStack = useSettingsStore((s) => s.createStack);
    const renameStack = useSettingsStore((s) => s.renameStack);
    const deleteStack = useSettingsStore((s) => s.deleteStack);

    const stacksList = useMemo(
        () => Object.values(stacks).map(({ id, name }) => ({ id, name })),
        [stacks]
    );
    const active = stacks[activeId];

    const [renameOpen, setRenameOpen] = useState(false);
    const [nameDraft, setNameDraft] = useState(active?.name ?? "");
    const renameRef = useRef<HTMLInputElement>(null);

    const [newOpen, setNewOpen] = useState(false);
    const [newName, setNewName] = useState("");

    const [delOpen, setDelOpen] = useState(false);

    useEffect(() => {
        const current = active?.name ?? "";
        setNameDraft(current);
        const base = t("stacks.newStackBase", { defaultValue: "New Stack" }) as string;
        const existingNames = stacksList.map((s) => s.name);
        const suggested = existingNames.includes(base) ? nextCopyName(base, existingNames) : base;
        setNewName(suggested);
    }, [activeId, active?.name, stacksList, t]);

    const handleRenameChange = (val: string) => {
        setNameDraft(val);
        if (!active) return;
        // const trimmed = val.trim();
        renameStack(
            active.id,
            val.length ? val : (t("stacks.untitled", { defaultValue: "Untitled" }) as string)
        );
    };

    const handleCreateNew = () => {
        const newId = createStack();
        const trimmed = newName.trim();
        const finalName = trimmed.length
            ? trimmed
            : (t("stacks.newStackBase", { defaultValue: "New Stack" }) as string);
        renameStack(newId, finalName);
        setActiveStack(newId);
        setNewOpen(false);
        setTimeout(() => {
            setRenameOpen(true);
            requestAnimationFrame(() => renameRef.current?.focus());
        }, 0);
    };

    const handleConfirmDelete = () => {
        if (!active) return;
        deleteStack(active.id);
        setDelOpen(false);
    };

    return (
        <div className="mb-2 rounded-2xl border border-gray-200 bg-white/80 p-2 md:p-3">
            <div className="flex flex-wrap items-center gap-2">
                <StacksManagerSelect
                    activeId={activeId}
                    stacks={stacksList}
                    nameDraftActive={nameDraft}
                    onChange={setActiveStack}
                />

                <div className="flex items-center gap-2">
                    <StacksManagerRenamePopover
                        open={renameOpen}
                        setOpen={setRenameOpen}
                        nameDraft={nameDraft}
                        onChange={handleRenameChange}
                        inputRef={renameRef}
                    />
                    <StacksManagerNewPopover
                        open={newOpen}
                        setOpen={setNewOpen}
                        newName={newName}
                        setNewName={setNewName}
                        onCreate={handleCreateNew}
                    />

                    <StacksManagerDeletePopover
                        open={delOpen}
                        setOpen={setDelOpen}
                        canDelete={stacksList.length > 1}
                        activeName={active?.name}
                        onConfirm={handleConfirmDelete}
                    />
                </div>
            </div>

            <p className="mt-1 text-[11px] text-gray-500">
                {t("stacks.note", { defaultValue: "Each stack has its own settings and history." })}
            </p>
        </div>
    );
}

export default StacksManager;
