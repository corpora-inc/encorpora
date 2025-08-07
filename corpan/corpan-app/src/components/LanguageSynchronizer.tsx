import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";

const LanguageSynchronizer = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();
  // Get the current language from the Zustand store
  const language = useSettingsStore((state) => state.topLang);

  // This useEffect will run whenever the 'language' in the store changes.
  useEffect(() => {
    const val = language();
    i18n.changeLanguage(val);
  }, [language, i18n]);

  // Optional: Listen for external i18n changes to update the store
  useEffect(() => {
    const handleLanguageChange = (lng: string) => {
      const [_, ...rest] = useSettingsStore.getState().languages;
      useSettingsStore.getState().setLanguages([lng, ...rest]);
    };

    i18n.on("languageChanged", handleLanguageChange);

    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, [i18n]);

  return children;
};

export default LanguageSynchronizer;
