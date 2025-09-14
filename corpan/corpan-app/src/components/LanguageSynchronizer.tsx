// src/components/LanguageSynchronizer.tsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";

const LanguageSynchronizer = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();

  // Select the actual primary language string; updates when stack/languages change.
  const primary = useSettingsStore((s) => s.primaryLang());

  useEffect(() => {
    if (!primary) return;

    const ns = (i18n.options.defaultNS as string) || "common";
    const base = primary.split("-")[0];
    const next =
      i18n.hasResourceBundle(primary, ns) ? primary :
        i18n.hasResourceBundle(base, ns) ? base :
          primary; // no swallowing; if missing, let it surface

    if (i18n.language !== next) {
      void i18n.changeLanguage(next);
    }
  }, [primary, i18n]);

  // If i18n changes (keyboard, devtools, etc.), move that lang to front of the active stack.
  useEffect(() => {
    const onChange = (lng: string) => {
      const state = useSettingsStore.getState();
      const current = state.languages || [];
      // Prefer exact match; else prefer first language sharing base (e.g., pt-BR for "pt")
      const base = lng.split("-")[0];
      const exact = current.find((c) => c === lng);
      const byBase = current.find((c) => c.split("-")[0] === base);
      const chosen = exact || byBase || lng;

      const rest = current.filter((c) => c !== chosen);
      state.setLanguages([chosen, ...rest]);
    };

    i18n.on("languageChanged", onChange);
    return () => {
      i18n.off("languageChanged", onChange);
    };
  }, [i18n]);

  return children;
};

export default LanguageSynchronizer;
