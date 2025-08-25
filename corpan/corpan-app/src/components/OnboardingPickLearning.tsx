import { useMemo } from "react";
import { useSettingsStore, ALL_LANGUAGES } from "@/store/settings";
import { ArrowRightCircle, ArrowLeftCircle, CheckCircle2 } from "lucide-react";
import { ScrollIndicatorWrapper } from "./ScrollIndicatorWrapper";
import { useTranslation } from "react-i18next";
import { toCamelCase } from "@/util/convert";

export function OnboardingPickLearning() {
  const setStep = useSettingsStore((s) => s.setOnboardingStep);
  const languages = useSettingsStore((s) => s.languages);
  const setLanguages = useSettingsStore((s) => s.setLanguages);
  const { t, i18n } = useTranslation();
  const dir = useSettingsStore((s) => s.dir);

  // Primary at the START
  const primary = languages[0];
  const learning = languages.slice(1);
  const choices = ALL_LANGUAGES.filter((code) => code !== primary);

  const toggleLearning = (code: string) => {
    const selected = learning.includes(code)
      ? learning.filter((c) => c !== code)
      : [...learning, code];
    // Keep primary at the start
    setLanguages([primary, ...selected]);
  };

  const canProceed = learning.length > 0;

  // Locale-aware sorting by translated label
  const sortedChoices = useMemo(() => {
    const collator = new Intl.Collator(i18n.language || "en", {
      sensitivity: "base",
      ignorePunctuation: true,
      numeric: true,
    });

    const items = choices.map((code) => {
      const key = `languages.${toCamelCase(code)}` as const;
      const label = t(key, { defaultValue: code }) as string;
      return { code, label };
    });

    items.sort((a, b) => collator.compare(a.label, b.label));
    return items;
  }, [choices, t, i18n.language]);

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full w-full mt-15">
      {/* Header always on top */}
      <div className="w-full max-w-xl mx-auto flex flex-row items-center justify-between py-5 px-2"
        style={{ height: 100 }}
      >
        <button
          className="flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-full p-3 shadow transition border"
          onClick={() => setStep(1)}
          tabIndex={0}
        >
          <ArrowLeftCircle size={30} />
        </button>
        <div
          className="flex-1 text-center text-lg font-semibold text-gray-800 select-none px-1"
          style={{ letterSpacing: 0.25 }}
          dir={dir()}
        >
          {t("onboarding.pickLanguagesToLearn")}
        </div>
        <button
          className={`flex items-center justify-center rounded-full p-3 shadow transition
            ${canProceed
              ? "bg-black hover:bg-gray-900 text-white border border-purple-400"
              : "bg-gray-200 text-gray-400 border cursor-not-allowed"
            }`}
          onClick={() => canProceed && setStep(3)}
          disabled={!canProceed}
          tabIndex={0}
        >
          <ArrowRightCircle size={30} />
        </button>
      </div>

      {/* Make the outer container the scroll area (like Pick Primary) */}
      <ScrollIndicatorWrapper className="flex-1 min-h-0 w-full">
        <div className="w-full max-w-xl flex flex-col gap-2 items-stretch px-2 pb-10 mx-auto">
          {sortedChoices.map(({ code, label }) => {
            const selected = learning.includes(code);
            return (
              <button
                key={code}
                onClick={() => toggleLearning(code)}
                lang={code}
                className={`
                  w-full px-5 py-4
                  rounded-2xl shadow
                  bg-white border border-gray-200
                  text-lg font-semibold text-gray-900
                  flex items-center justify-between
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                  hover:bg-gray-50 hover:border-purple-400
                  transition
                  ${dir() === "rtl" ? "text-right" : "text-left"}
                  break-words
                  select-text
                  ${selected ? "border-purple-500 bg-purple-50" : ""}
                `}
                style={{
                  minHeight: 56,
                  wordBreak: "break-word",
                  whiteSpace: "normal",
                  lineHeight: 1.25,
                }}
                dir={dir()}
              >
                <span className="flex-1">{label}</span>
                {selected ? (
                  <CheckCircle2 className="ml-4 shrink-0 w-6 h-6 text-purple-500" size={24} />
                ) : (
                  <span className="ml-4 shrink-0 w-6 h-6" />
                )}
              </button>
            );
          })}
        </div>
      </ScrollIndicatorWrapper>
    </div>
  );
}