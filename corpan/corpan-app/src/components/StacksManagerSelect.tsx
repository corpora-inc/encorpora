import { Select, SelectTrigger, SelectContent, SelectGroup, SelectItem, SelectValue } from "@/components/ui/select";
import { dir } from "i18next";
import { useTranslation } from "react-i18next";

type StackListItem = { id: string; name: string };

export default function StacksManagerSelect({
    activeId,
    stacks,
    nameDraftActive,
    onChange,
}: {
    activeId: string;
    stacks: StackListItem[];
    nameDraftActive?: string;
    onChange: (id: string) => void;
}) {
    const { t } = useTranslation();
    return (
        <div className="min-w-[220px] flex-1">
            <Select value={activeId} onValueChange={onChange}>
                <SelectTrigger
                    className="cursor-pointer"
                    aria-label={t("stacks.selectAria", { defaultValue: "Select a stack" }) as string}
                >
                    <SelectValue placeholder={t("stacks.selectPlaceholder", { defaultValue: "Choose…" }) as string} />
                </SelectTrigger>
                <SelectContent containerId="settings-modal-content"
                    dir={dir()}
                >
                    <SelectGroup
                        dir={dir()}
                    >
                        {stacks.map((s) => (
                            <SelectItem key={s.id} value={s.id} className="cursor-pointer"
                                dir={dir()}
                            >
                                {s.id === activeId ? nameDraftActive || s.name : s.name}
                            </SelectItem>
                        ))}
                    </SelectGroup>
                </SelectContent>
            </Select>
        </div>
    );
}
