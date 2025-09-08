export function toCamelCase(val: string): string {
  return val.replace(/-(\w)/g, (_, c) => c.toUpperCase());
}


export function isRTL(langCode: string): boolean {
  const base = langCode.split("-")[0];
  const RTL_LANGUAGES = ["ar", "he", "fa", "ur"];
  return RTL_LANGUAGES.includes(base);
}
