import { useCallback } from "react";
import { translate, type StringKey } from "../i18n/index.ts";
import { useSettings } from "../store/settings.ts";

export function useT() {
  const lang = useSettings((s) => s.lang);
  return useCallback((key: StringKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
}
