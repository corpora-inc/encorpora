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
import { Crown, GripVertical, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ALL_LANGUAGES, useSettingsStore } from "@/store/settings";

function lockScroll(lock: boolean) {
  const ids = ["settings-modal-content", "onboarding-scroll"]; // modal first, then onboarding
  for (const id of ids) {
    const el = document.getElementById(id) as HTMLElement | null;
    if (!el) continue;

    if (lock) {
      // stash current values so we can restore exactly
      if (!("prevOverflowY" in el.dataset)) {
        el.dataset.prevOverflowY = getComputedStyle(el).overflowY;
      }
      if (!("prevTouchAction" in el.dataset)) {
        el.dataset.prevTouchAction = el.style.touchAction || "";
      }
      if (!("prevOverscroll" in el.dataset)) {
        el.dataset.prevOverscroll = el.style.overscrollBehaviorY || "";
      }

      // freeze scroll + stop scroll chaining on iOS/mac catalyst
      el.style.overflowY = "hidden";
      el.style.touchAction = "none";             // iOS 13+ honored in WKWebView
      el.style.overscrollBehaviorY = "contain";  // avoid bounce / chain
    } else {
      // restore
      el.style.overflowY = el.dataset.prevOverflowY || "";
      el.style.touchAction = el.dataset.prevTouchAction || "";
      el.style.overscrollBehaviorY = el.dataset.prevOverscroll || "";
      delete el.dataset.prevOverflowY;
      delete el.dataset.prevTouchAction;
      delete el.dataset.prevOverscroll;
    }
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
  return (
    <div
      className={`
        group relative flex items-center gap-2
        rounded-lg border px-3 py-2.5
        shadow-sm select-none
        transition-[background,border-color,box-shadow,transform]
        ${isPrimary
          ? "border-purple-300 bg-purple-50 dark:border-purple-700/60 dark:bg-purple-950/40"
          : "border-border bg-background hover:border-purple-300/60"}
        ${isDragging ? "opacity-80 border-purple-400 shadow-xl scale-[1.01]" : ""}
      `}
      style={{ minWidth: 0 }}
      {...props}
    >
      <span
        className="me-0.5 shrink-0 text-muted-foreground/70 cursor-grab touch-none"
        aria-hidden="true"
        {...dragHandleProps}
      >
        <GripVertical size={16} />
      </span>
      <span
        className="flex-1 truncate cursor-grab touch-none text-sm font-semibold text-foreground"
        {...dragHandleProps}
      >
        {t(`languages.${code}` as any)}
      </span>
      {isPrimary && (
        <Crown
          size={14}
          className="shrink-0 text-purple-500 dark:text-purple-300"
          aria-label={t("settings.primaryLanguage", { defaultValue: "Primary (UI) language" })}
        />
      )}
      {onRemove && (
        <button
          type="button"
          className="
            ms-1 shrink-0 rounded-md p-1
            text-muted-foreground/50
            hover:bg-red-50 hover:text-red-500
            dark:hover:bg-red-950/40
            transition-colors
          "
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
    lockScroll(false);
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
        onDragStart={() => lockScroll(true)}
        onDragEnd={handleDragEnd}
        onDragCancel={() => lockScroll(false)}
      >
        <SortableContext items={displayedLanguages} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-1">
            {displayedLanguages.map((code, i) => (
              <SortableLangChip
                key={code}
                code={code}
                onRemove={
                  displayedLanguages.length > 1
                    ? () => handleRemove(code)
                    : undefined
                }
                isPrimary={i === displayedLanguages.length - 1}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {available.length > 0 && (
        <section className="mt-6" aria-labelledby="add-more-langs">
          <header className="mb-2 flex items-center gap-1.5">
            <Plus size={14} className="text-muted-foreground/80" aria-hidden="true" />
            <span
              id="add-more-langs"
              className="text-xs font-medium tracking-wide text-muted-foreground"
            >
              {t("settings.addMoreLanguages")}
            </span>
          </header>
          <div className="flex flex-wrap gap-1.5">
            {available.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => handleAdd(code)}
                className="
                  group inline-flex items-center gap-1
                  rounded-full border border-border bg-background
                  px-3 py-1.5
                  text-xs font-medium
                  transition-[background,border-color,transform]
                  hover:border-purple-300 hover:bg-accent
                  active:scale-[0.97]
                  cursor-pointer
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                "
              >
                <Plus
                  size={12}
                  className="shrink-0 text-muted-foreground/60 transition-colors group-hover:text-purple-500"
                  aria-hidden="true"
                />
                <span>{t(`languages.${code}` as any) || code}</span>
              </button>
            ))}
          </div>
        </section>
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
