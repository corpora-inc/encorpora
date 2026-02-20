// src/components/onboarding/OnboardingPickPrimary.tsx

import {
  useSettingsStore,
  ALL_LANGUAGES,
  COMING_SOON_LANGUAGES,
} from "@/store/settings";
import { TRANSLATIONS } from "@/store/translations";
import { ArrowRightCircle } from "lucide-react";
import { useRef, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export function OnboardingPickPrimary() {
  const setStep = useSettingsStore((s) => s.setOnboardingStep);
  const setLanguages = useSettingsStore((s) => s.setLanguages);
  const { i18n } = useTranslation();

  const handleSelect = (code: string) => {
    i18n.changeLanguage(code);
    setLanguages([code]);
    setStep(2);
  };

  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const updateOffset = () => {
      const wrapper = wrapperRef.current;
      const container = containerRef.current;
      if (!wrapper || !container) return;

      const containerHeight = container.clientHeight;
      const contentHeight = wrapper.scrollHeight;

      // Only center if content fits without scroll
      if (contentHeight < containerHeight) {
        setOffset((containerHeight - contentHeight) / 2);
      } else {
        setOffset(0);
      }
    };

    updateOffset();
    window.addEventListener("resize", updateOffset);
    return () => window.removeEventListener("resize", updateOffset);
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex flex-col flex-1 min-h-0 w-full h-full p-2 my-5"
    >
      <div
        ref={wrapperRef}
        className="w-full max-w-xl flex flex-col gap-2 items-stretch mx-auto"
        style={{
          minHeight: 0,
          transform: `translateY(${offset}px)`,
          transition: "transform 0.35s cubic-bezier(.4,1.4,.5,1)",
          paddingBottom: "env(safe-area-inset-bottom)",
          paddingTop: "env(safe-area-inset-top)",
        }}
      >
        {ALL_LANGUAGES.map((code) => {
          const label = TRANSLATIONS.getMakePrimaryLabel(code);

          return (
            <button
              key={code}
              onClick={() => handleSelect(code)}
              lang={code}
              className={`
                w-full px-5 py-4
                rounded-md shadow
                bg-background border border-border
                text-lg font-semibold text-foreground
                flex items-center justify-between
                focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400
                hover:bg-accent hover:border-purple-400
                transition
                text-left
                break-words
                select-text
                hover:cursor-pointer
              `}
              style={{
                minHeight: 56,
                wordBreak: "break-word",
                whiteSpace: "normal",
                lineHeight: 1.25,
              }}
            >
              <span className="flex-1">{label}</span>
              <ArrowRightCircle
                className="ml-4 shrink-0 text-muted-foreground"
                size={22}
              />
            </button>
          );
        })}

        {COMING_SOON_LANGUAGES.length > 0 && (
          <div className="mt-6 space-y-2">
            <p className="text-xs font-medium tracking-wide text-muted-foreground">
              More languages coming soon
            </p>

            {COMING_SOON_LANGUAGES.map((code) => {
              const autonym = TRANSLATIONS.getAutonym(code);
              const statusLabel = TRANSLATIONS.getComingSoonLabel(code); // native-language status

              return (
                <div
                  key={code}
                  lang={code}
                  className={`
                    relative
                    w-full px-5 py-4
                    rounded-md border border-dashed border-border
                    bg-gradient-to-r from-muted to-muted
                    flex items-center
                    text-left
                    cursor-default
                    select-none
                  `}
                  style={{
                    minHeight: 56,
                    wordBreak: "break-word",
                    whiteSpace: "normal",
                    lineHeight: 1.25,
                  }}
                  aria-hidden="true"
                >
                  <div className="flex-1">
                    <span className="text-base font-semibold text-foreground">
                      {autonym}
                    </span>
                  </div>

                  {/* status pill: native-language text + right-aligned yellow dot */}
                  <div className="absolute top-3 right-4 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
                    <span className="max-w-[120px] truncate text-right">
                      {statusLabel}
                    </span>
                    <span
                      className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse"
                      aria-hidden="true"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
