import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import {
  DndContext,
  PointerSensor,
  useSensors,
  useSensor,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { GripVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toCamelCase } from "@/util/convert";
// import i18n from "@/i18n";

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
                flex items-center gap-1 px-3 py-1 rounded-lg border bg-white shadow-sm
                ${isPrimary ? "bg-purple-50 border-purple-300" : ""}
                ${isDragging ? "opacity-60 border-blue-400 shadow-lg" : ""}
                select-none mb-1
            `}
      style={{ minWidth: 0 }}
      {...props}
    >
      <span className="mr-1 text-gray-400 cursor-grab " {...dragHandleProps}>
        <GripVertical size={16} />
      </span>
      <span
        className="flex-1 truncate cursor-grab"
        {...dragHandleProps}
        dir={dir()}
      >
        {/* {LANGUAGE_NAMES[code] || code} */}
        {/* TODO */}
        {t(`languages.${toCamelCase(code)}` as any)}
      </span>
      {onRemove && (
        <button
          type="button"
          className="ml-2 p-0.5 text-gray-300 hover:text-red-400 z-1000"
          aria-label="Remove language"
          tabIndex={0}
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

  // DnD-kit
  const sensors = useSensors(useSensor(PointerSensor));

  // Handlers
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
  };

  const handleRemove = (code: string) => {
    if (languages.length <= 1) return; // Don't allow removing last
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

  // Find unselected languages
  const available = ALL_LANGUAGES.filter((c) => !languages.includes(c));

  return (
    <div className="w-full">
      <div className="mb-3 font-semibold text-sm" dir={dir()}>
        {t("settings.selectedLanguages")}
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={() => {
          const el = document.querySelector(
            "#settings-modal-content"
          ) as HTMLElement;
          if (el) el.style.overflow = "hidden";
        }}
        onDragEnd={(event) => {
          handleDragEnd(event);
          const el = document.querySelector(
            "#settings-modal-content"
          ) as HTMLElement;
          if (el) el.style.overflow = "";
        }}
        onDragCancel={() => {
          const el = document.querySelector(
            "#settings-modal-content"
          ) as HTMLElement;
          if (el) el.style.overflow = "";
        }}
      >
        <SortableContext
          items={displayedLanguages}
          strategy={verticalListSortingStrategy}
        >
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
        <div className="mt-4" dir={dir()}>
          <div className="mb-2 text-xs text-gray-500" dir={dir()}>
            {t("settings.addMoreLanguages")}
          </div>
          <div className="flex flex-wrap gap-2">
            {available.map((code) => (
              <Button
                key={code}
                variant="outline"
                size="sm"
                className="rounded-full text-xs p-3"
                onClick={() => handleAdd(code)}
              >
                <Plus size={15} />
                <span className="mr-1" dir={dir()}>
                  {t(`languages.${toCamelCase(code)}` as any) || code}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}
      {languages.length === 1 && (
        <div className="mt-3 text-xs text-red-400">
          At least one language required.
        </div>
      )}
    </div>
  );
}

// --- Sortable chip wrapper ---
function SortableLangChip({
  code,
  onRemove,
  isPrimary,
}: {
  code: string;
  onRemove?: () => void;
  isPrimary?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: code });
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
