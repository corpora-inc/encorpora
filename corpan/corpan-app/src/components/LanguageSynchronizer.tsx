// src/components/LanguageSynchronizer.tsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";

const LanguageSynchronizer = ({ children }: { children: React.ReactNode }) => {
  const { i18n } = useTranslation();

  // Read the actual value (not the function) so React tracks it correctly
  const primary = useSettingsStore((s) => s.languages[0]);
  const activeStackId = useSettingsStore((s) => s.activeStackId);

  // One-way sync: store -> i18n. No i18n -> store writes.
  useEffect(() => {
    if (!primary) return;
    if (i18n.language !== primary) {
      i18n.changeLanguage(primary);
    }
  }, [primary, activeStackId, i18n]);

  return children;
};

export default LanguageSynchronizer;
