// src/components/StacksManager.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useSettingsStore } from "@/store/settings";
import { useTranslation } from "react-i18next";
import StacksManagerSelect from "./StacksManagerSelect";
import StacksManagerRenamePopover from "./StacksManagerRenamePopover";
import StacksManagerNewPopover from "./StacksManagerNewPopover";
import StacksManagerDeletePopover from "./StacksManagerDeletePopover";
import { dir } from "i18next";

function genWhimsy(existing: string[]): string {
    const glyphs = "αβγδεζηθικλμνξοπρστυφχψω";
    let s = "";
    for (let i = 0; i < 3; i++) {
        s += glyphs[Math.floor(Math.random() * glyphs.length)];
    }
    // avoid exact collisions, just in case
    if (existing.includes(s)) return genWhimsy(existing);
    return s;
}

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

    // Popover states
    const [renameOpen, setRenameOpen] = useState(false);
    const [newOpen, setNewOpen] = useState(false);
    const [delOpen, setDelOpen] = useState(false);

    // Local drafts (no write-through during typing)
    const [nameDraft, setNameDraft] = useState(active?.name ?? "");
    const [newName, setNewName] = useState("");

    const renameRef = useRef<HTMLInputElement>(null);

    // Sync drafts when active stack changes
    useEffect(() => {
        setNameDraft(active?.name ?? "");
        // New Stack input starts blank; placeholder handles affordance
        setNewName("");
    }, [activeId, active?.name]);

    // Live typing only updates draft (never “Untitled”)
    const handleRenameChange = (val: string) => {
        setNameDraft(val);
        // optional live preview in select (we already pass nameDraftActive), but do NOT persist here
    };

    // Commit rename when the popover closes; if empty, generate whimsy
    useEffect(() => {
        if (renameOpen) return;
        if (!active) return;

        const trimmed = nameDraft.trim();
        if (trimmed.length > 0) {
            if (trimmed !== active.name) renameStack(active.id, trimmed);
            return;
        }

        // Empty on close → synthesize short fun name
        const existingNames = stacksList.map((s) => s.name);
        const funky = genWhimsy(existingNames);
        renameStack(active.id, funky);
        setNameDraft(funky); // reflect immediately in UI
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [renameOpen]); // relies on nameDraft, active, stacksList via closure

    // Create new: blank allowed → synthesize if empty
    const handleCreateNew = () => {
        const newId = createStack();
        const trimmed = newName.trim();
        const finalName =
            trimmed.length > 0 ? trimmed : genWhimsy(stacksList.map((s) => s.name));

        renameStack(newId, finalName);
        setActiveStack(newId);
        setNewOpen(false);
        // Do NOT auto-open rename; we “roll out with the name we already input”
    };

    const handleConfirmDelete = () => {
        if (!active) return;
        deleteStack(active.id);
        setDelOpen(false);
    };

    return (
        <div className="mb-2 rounded-md border p-2 md:p-3"
            //   ${dir() === "rtl" ? "text-right" : "text-left"}
            dir={dir()}
        >
            <div className="flex flex-wrap items-center gap-2">
                <StacksManagerSelect
                    activeId={activeId}
                    stacks={stacksList}
                    nameDraftActive={nameDraft} // shows draft for the active item while typing
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
