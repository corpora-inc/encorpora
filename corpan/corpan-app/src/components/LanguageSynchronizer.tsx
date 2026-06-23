// src/components/LanguageSynchronizer.tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DirectionProvider } from "@radix-ui/react-direction";
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

  // Track the *currently rendered* UI language so direction updates reactively.
  // Driven off i18n's own event so it also covers the onboarding language
  // picker, which calls changeLanguage() directly before `primary` is set.
  const [lng, setLng] = useState<string>(i18n.language || "en");
  useEffect(() => {
    const onChange = (l: string) => setLng(l || "en");
    i18n.on("languageChanged", onChange);
    setLng(i18n.language || "en");
    return () => i18n.off("languageChanged", onChange);
  }, [i18n]);

  const dir: "rtl" | "ltr" = isRTL(lng) ? "rtl" : "ltr";

  // Mirror direction onto the <html> root (scrollbar edge, native form
  // controls, text selection, font/shaping hints, screen-reader direction) —
  // this is also what Tailwind's `rtl:` utility variants key off. The whole
  // shell flips as one unit instead of piecemeal per subtree.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("lang", lng);
    root.setAttribute("dir", dir);
  }, [lng, dir]);

  // Radix primitives (Select, Slider, DropdownMenu, Popover, Tabs, …) read
  // direction from this provider, NOT from document.dir — without it they stay
  // LTR internally even when the page is RTL. One provider flips them all.
  return <DirectionProvider dir={dir}>{children}</DirectionProvider>;
};

export default LanguageSynchronizer;
