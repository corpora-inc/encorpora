import { en, type Strings } from "./en.ts";

export type Lang = "en";
export type StringKey = keyof Strings;

const TABLES: Record<Lang, Strings> = { en };
export const LANGS: readonly Lang[] = ["en"];

/** Look up a string; `{name}` placeholders are filled from vars. */
export function translate(lang: Lang, key: StringKey, vars?: Record<string, string | number>): string {
  const table = TABLES[lang] ?? en;
  let s: string = table[key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Plural by count: key.one / key.other style tables. */
export function plural(lang: Lang, n: number, one: StringKey, other: StringKey, vars?: Record<string, string | number>) {
  return translate(lang, n === 1 ? one : other, { n, ...vars });
}
