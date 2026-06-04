// src/components/LanguageSynchronizer.tsx
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/store/settings";
import { isRTL } from "@/util/convert";

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

  // Mirror the *currently rendered* UI language onto the <html> root so the
  // whole shell flips as one unit in RTL (scrollbar edge, native form
  // controls, text selection, font/shaping hints, screen-reader direction).
  // Components also set `dir` on their own subtrees, but the root must agree
  // or Arabic/Hebrew/Persian chrome renders piecemeal and looks scrambled.
  // Driven off i18n's own event so it also covers the onboarding language
  // picker, which calls changeLanguage() directly before `primary` is set.
  useEffect(() => {
    const apply = (lng?: string) => {
      const root = document.documentElement;
      const code = lng || "en";
      root.setAttribute("lang", code);
      root.setAttribute("dir", isRTL(code) ? "rtl" : "ltr");
    };
    apply(i18n.language);
    i18n.on("languageChanged", apply);
    return () => i18n.off("languageChanged", apply);
  }, [i18n]);

  return children;
};

export default LanguageSynchronizer;
