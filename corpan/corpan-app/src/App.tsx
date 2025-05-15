import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Button } from "@/components/ui/button";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./index.css";

// import "@/util/speak";
import { createVoiceTTS } from "./util/speak";

type TranslationOut = { language_code: string; text: string; };
type EntryOut = {
  entry_id: number;
  en_text: string;
  level: string;
  domains: string[];
  translations: TranslationOut[];
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  "ko-polite": "Korean (Polite)",
  es: "Spanish",
  fr: "French",
  de: "German",
  "pt-BR": "Portuguese (BR)",
  ja: "Japanese",
  "zh-Hans": "Chinese (Simplified)",
  ar: "Arabic",
  ru: "Russian",
  it: "Italian",
  hi: "Hindi",
};
const ALL_LANGUAGE_CODES = Object.keys(LANGUAGE_NAMES);

const LANG_PREF_KEY = "corpan_lang_prefs";

// Sortable item for DnD
function LangChip({ code, active, ...props }: { code: string; active?: boolean;[k: string]: any }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: code });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: active ? "#eef" : "#f8f8f8",
        border: "1px solid #bbb",
        borderRadius: 8,
        padding: "0.5em 1em",
        margin: "0 4px",
        cursor: "grab",
        fontWeight: 500,
        display: "inline-block",
      }}
      {...attributes}
      {...listeners}
      {...props}
    >
      {LANGUAGE_NAMES[code] || code}
    </div>
  );
}

export default function App() {
  // State: ordered language codes to display
  const [selectedLangs, setSelectedLangs] = useState<string[]>(() => {
    const raw = localStorage.getItem(LANG_PREF_KEY);
    // cheap way to clear.
    // localStorage.removeItem(LANG_PREF_KEY); // Remove from localStorage to avoid confusion
    return raw ? JSON.parse(raw) : ["en", "es", "pt-BR", "fr", "it", "ko-polite"];
  });
  // All entries in history (as before)
  const [history, setHistory] = useState<EntryOut[]>([]);
  const [index, setIndex] = useState(-1);
  const [loading, setLoading] = useState(true);

  // Sensors for DnD
  const sensors = useSensors(useSensor(PointerSensor));

  // Persist language prefs
  useEffect(() => {
    localStorage.setItem(LANG_PREF_KEY, JSON.stringify(selectedLangs));
  }, [selectedLangs]);

  // Load one entry on start
  useEffect(() => {
    fetchNewEntry();
    // eslint-disable-next-line
  }, []);

  // Fetch new entry in the selected languages
  async function fetchNewEntry() {
    setLoading(true);
    const entry = await invoke<EntryOut>("get_random_entry_with_translations", {
      languageCodes: selectedLangs,
    });
    setHistory(prev => {
      const next = [...prev, entry];
      setIndex(next.length - 1);
      return next;
    });

    setLoading(false);
  }

  // Multi-select language toggling
  function toggleLang(code: string) {
    setSelectedLangs(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  // Drag-and-drop reorder handler
  function handleDragEnd(event: any) {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = selectedLangs.indexOf(active.id);
      const newIndex = selectedLangs.indexOf(over.id);
      setSelectedLangs(arrayMove(selectedLangs, oldIndex, newIndex));
    }
  }

  // Current entry to display
  const curr = history[index];

  // Map: language_code → text
  const textByLang: Record<string, string> = {};
  curr?.translations.forEach(t => { textByLang[t.language_code] = t.text; });
  textByLang["en"] = curr?.en_text || "";

  return (
    <div className="p-4 w-full max-w-4xl mx-auto">
      {/* Language selector: checkboxes and DnD chips */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="mr-2 font-semibold text-sm">Languages:</span>
        {ALL_LANGUAGE_CODES.map(code => (
          <label key={code} className="flex items-center mr-2">
            <input
              type="checkbox"
              checked={selectedLangs.includes(code)}
              onChange={() => toggleLang(code)}
              className="mr-1"
            />
            <span>{LANGUAGE_NAMES[code]}</span>
          </label>
        ))}
      </div>
      {/* Drag to reorder */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={selectedLangs} strategy={verticalListSortingStrategy}>
          <div className="flex flex-row gap-4 mb-4 overflow-x-auto">
            {selectedLangs.map(code => {
              if (LANGUAGE_NAMES[code] === undefined) return null;
              return <LangChip key={code} code={code} active />
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Sentence columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {selectedLangs.filter(code => LANGUAGE_NAMES[code] !== undefined).map(code => (
          <div
            key={code}
            className="flex flex-col items-center bg-gray-50 border rounded-lg p-4 shadow min-h-[140px]"
          >
            <div className="text-xs text-gray-500 mb-1">{LANGUAGE_NAMES[code] || code}</div>
            <div className={"text-xl text-center font-bold"}
              dir={code === "ar" ? "rtl" : "ltr"}
            >

              {textByLang[code] || <span className="opacity-50">—</span>}
            </div>
            <Button
              onClick={() => {
                // get text in code before `-`
                const langPrefix = code.split("-")[0];
                const tts = createVoiceTTS(langPrefix);
                tts(textByLang[code]);
              }}
              className="mt-2"
              variant="outline"
            >Speak</Button>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="mt-6 flex justify-center gap-4">
        <Button onClick={fetchNewEntry} disabled={loading}>Next</Button>
      </div>
    </div>
  );
}
