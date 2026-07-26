/**
 * BZ-LAW-2 — the bazaar has no interface text.
 *
 * Not one label, not one button caption, not one status line. Signs carry a
 * place name and a worked example; everything else is an object you touch.
 *
 * What remains is the irreducible accessibility surface: the five day-states of
 * the lamp (a glance is not available to everyone), and a name for each of the
 * four things a screen reader must be able to identify. **Twelve strings, and
 * BZ-14 fails the build at thirteen.**
 *
 * Place names are not in here. They are content records on the quarter — the
 * bazaar does not own them any more than it owns a game's name.
 *
 * Launch locales per ADR-0007: en, es, pt-BR, fr, de.
 */

export type Locale = "en" | "es" | "pt-BR" | "fr" | "de";

export const LOCALES: readonly Locale[] = ["en", "es", "pt-BR", "fr", "de"];

export type StringKey =
  | "day.morning"
  | "day.midday"
  | "day.afternoon"
  | "day.evening"
  | "day.lit"
  | "street"
  | "finder"
  | "sound.on"
  | "sound.off"
  | "lamplighter"
  | "stall"
  | "scaffold";

type Table = Record<StringKey, string>;

const en: Table = {
  "day.morning": "Morning at the bazaar.",
  "day.midday": "Midday at the bazaar.",
  "day.afternoon": "Afternoon at the bazaar.",
  "day.evening": "Evening light at the bazaar.",
  "day.lit": "The lamps are lit.",
  street: "The bazaar",
  finder: "Finder",
  "sound.on": "Sound on",
  "sound.off": "Sound off",
  lamplighter: "The lamplighter",
  stall: "{name}, {quarter}, {specimen}",
  scaffold: "{quarter}, still being built",
};

const es: Table = {
  "day.morning": "Mañana en el zoco.",
  "day.midday": "Mediodía en el zoco.",
  "day.afternoon": "Tarde en el zoco.",
  "day.evening": "Luz de atardecer en el zoco.",
  "day.lit": "Las lámparas están encendidas.",
  street: "El zoco",
  finder: "Buscador",
  "sound.on": "Sonido activado",
  "sound.off": "Sonido desactivado",
  lamplighter: "El farolero",
  stall: "{name}, {quarter}, {specimen}",
  scaffold: "{quarter}, todavía en obras",
};

const ptBR: Table = {
  "day.morning": "Manhã no bazar.",
  "day.midday": "Meio-dia no bazar.",
  "day.afternoon": "Tarde no bazar.",
  "day.evening": "Luz do entardecer no bazar.",
  "day.lit": "As lâmpadas estão acesas.",
  street: "O bazar",
  finder: "Localizador",
  "sound.on": "Som ligado",
  "sound.off": "Som desligado",
  lamplighter: "O acendedor de lampiões",
  stall: "{name}, {quarter}, {specimen}",
  scaffold: "{quarter}, ainda em construção",
};

const fr: Table = {
  "day.morning": "Le matin au souk.",
  "day.midday": "Midi au souk.",
  "day.afternoon": "L’après-midi au souk.",
  "day.evening": "Lumière du soir au souk.",
  "day.lit": "Les lampes sont allumées.",
  street: "Le souk",
  finder: "Chercheur",
  "sound.on": "Son activé",
  "sound.off": "Son coupé",
  lamplighter: "L’allumeur de réverbères",
  stall: "{name}, {quarter}, {specimen}",
  scaffold: "{quarter}, encore en chantier",
};

const de: Table = {
  "day.morning": "Morgen im Basar.",
  "day.midday": "Mittag im Basar.",
  "day.afternoon": "Nachmittag im Basar.",
  "day.evening": "Abendlicht im Basar.",
  "day.lit": "Die Lampen brennen.",
  street: "Der Basar",
  finder: "Sucher",
  "sound.on": "Ton an",
  "sound.off": "Ton aus",
  lamplighter: "Der Laternenanzünder",
  stall: "{name}, {quarter}, {specimen}",
  scaffold: "{quarter}, noch im Bau",
};

export const STRINGS: Record<Locale, Table> = { en, es, "pt-BR": ptBR, fr, de };

export function resolveLocale(tag: string | undefined): Locale {
  if (!tag) return "en";
  const t = tag.toLowerCase();
  if (t.startsWith("pt")) return "pt-BR";
  if (t.startsWith("es")) return "es";
  if (t.startsWith("fr")) return "fr";
  if (t.startsWith("de")) return "de";
  return "en";
}

export function t(
  locale: Locale,
  key: StringKey,
  slots?: Record<string, string>,
): string {
  let s = STRINGS[locale][key];
  if (slots) {
    for (const [k, v] of Object.entries(slots)) s = s.split(`{${k}}`).join(v);
  }
  return s;
}
