import { RTL_LANGUAGES } from "@/store/constants";

/**
 * Check if a language code is right-to-left.
 * First checks the full code (e.g., "pa-Arab"), then falls back to base language (e.g., "ar").
 * This ensures pa-Arab is RTL but pa-Guru and pa are LTR.
 */
export function isRTL(langCode: string): boolean {
  // First check full code (handles "pa-Arab", "zh-Hans", etc.)
  if (RTL_LANGUAGES.includes(langCode)) {
    return true;
  }

  // Then check base language (handles "ar-SA" → "ar", "ur-PK" → "ur", etc.)
  const base = langCode.split("-")[0];
  return RTL_LANGUAGES.includes(base);
}
