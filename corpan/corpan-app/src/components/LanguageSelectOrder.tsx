import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensors,
  useSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ALL_LANGUAGES, useSettingsStore } from "@/store/settings";
import { toCamelCase } from "@/util/convert";

function lockOnboardingScroll(lock: boolean) {
  const el = document.getElementById("onboarding-scroll") as HTMLElement | null;
  if (!el) return;
  if (lock) {
    el.dataset.prevOverflowY = getComputedStyle(el).overflowY;
    el.style.overflowY = "hidden";
  } else {
    el.style.overflowY = el.dataset.prevOverflowY || "auto";
    delete el.dataset.prevOverflowY;
  }
}


function LangChip({
  code,
  onRemove,
  isDragging,
  isPrimary,
  dragHandleProps,
  ...props
}: {
  code: string;
  onRemove?: () => void;
  isDragging?: boolean;
  isPrimary?: boolean;
  dragHandleProps?: any;
  [k: string]: any;
}) {
  const { t } = useTranslation();
  const dir = useSettingsStore((s) => s.dir);
  return (
    <div
      className={`
        mb-1 flex items-center gap-1 rounded-md border bg-white px-3 py-1 shadow-sm select-none
        ${isPrimary ? "bg-purple-50 border-purple-300" : ""}
        ${isDragging ? "opacity-60 border-blue-400 shadow-lg" : ""}
      `}
      style={{ minWidth: 0 }}
      {...props}
    >
      <span
        className="mr-1 text-gray-400 cursor-grab touch-none"
        {...dragHandleProps}
      >
        <GripVertical size={16} />
      </span>
      <span
        className="flex-1 truncate cursor-grab touch-none"
        {...dragHandleProps}
        dir={dir()}
      >
        {t(`languages.${toCamelCase(code)}` as any)}
      </span>
      {onRemove && (
        <button
          type="button"
          className="z-50 ml-2 p-0.5 text-gray-300 hover:text-red-400"
          aria-label={t("settings.removeLanguage", { defaultValue: "Remove language" })}
          onClick={onRemove}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}

export function LanguageSelectOrder() {
  const languages = useSettingsStore((s) => s.languages);
  const setLanguages = useSettingsStore((s) => s.setLanguages);
  const dir = useSettingsStore((s) => s.dir);
  const { i18n, t } = useTranslation();

  const displayedLanguages = [...languages].reverse();

  // Sensors: Pointer + Touch with activation constraint for iOS
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 }, // small hold + wiggle to start drag
    })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIdx = displayedLanguages.indexOf(active.id);
      const newIdx = displayedLanguages.indexOf(over.id);
      if (oldIdx !== -1 && newIdx !== -1) {
        const reorderedDisplayed = [...displayedLanguages];
        reorderedDisplayed.splice(oldIdx, 1);
        reorderedDisplayed.splice(newIdx, 0, active.id);
        const newLanguages = [...reorderedDisplayed].reverse();
        setLanguages(newLanguages);
        i18n.changeLanguage(newLanguages[0]);
      }
    }
    lockOnboardingScroll(false);
  };

  const handleRemove = (code: string) => {
    if (languages.length <= 1) return;
    const newLanguages = languages.filter((c) => c !== code);
    setLanguages(newLanguages);
    i18n.changeLanguage(newLanguages[0]);
  };

  const handleAdd = (code: string) => {
    if (!languages.includes(code)) {
      const newLanguages = [...languages, code];
      setLanguages(newLanguages);
      i18n.changeLanguage(newLanguages[0]);
    }
  };

  const available = ALL_LANGUAGES.filter((c) => !languages.includes(c));

  return (
    <div className="w-full" dir={dir()}>
      <div className="mb-3 text-sm font-semibold">
        {t("settings.selectedLanguages")}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={() => lockOnboardingScroll(true)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => lockOnboardingScroll(false)}
      >
        <SortableContext items={displayedLanguages} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {displayedLanguages.map((code, i) => (
              <SortableLangChip
                key={code}
                code={code}
                onRemove={() => handleRemove(code)}
                isPrimary={i === displayedLanguages.length - 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {available.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-xs text-gray-500">
            {t("settings.addMoreLanguages")}
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((code) => (
              <Button
                key={code}
                variant="outline"
                size="sm"
                className="rounded-md p-3 text-xs hover:cursor-pointer"
                onClick={() => handleAdd(code)}
              >
                <Plus size={15} className="mr-1" />
                <span>{t(`languages.${toCamelCase(code)}` as any) || code}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SortableLangChip({
  code,
  onRemove,
  isPrimary,
}: {
  code: string;
  onRemove?: () => void;
  isPrimary?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: code });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
      }}
    >
      <LangChip
        code={code}
        onRemove={onRemove}
        isDragging={isDragging}
        isPrimary={isPrimary}
        dragHandleProps={listeners}
        {...attributes}
      />
    </div>
  );
}
