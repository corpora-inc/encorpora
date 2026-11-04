/** Grade-4 operation contexts. Numbers stay in the generator; these are the
 * situations a later grade can reuse. Money is named in words, never with $.
 * `classic` is the stored surface and is not listed here. */

export const operationStoryValues = [
  "classic",
  "sports",
  "pets",
  "cooking",
  "garden",
  "reading",
  "saving",
  "cards",
  "travel",
  "science",
  "music",
  "school",
] as const;

export type OperationStory = (typeof operationStoryValues)[number];

export const comparisonCast: Record<
  string,
  { a: string; b: string; noun: string }
> = {
  sports: { a: "Jamal", b: "Priya", noun: "points" },
  pets: { a: "Lena", b: "Mateo", noun: "fish" },
  cooking: { a: "Rosa", b: "Omar", noun: "cookies" },
  garden: { a: "Ava", b: "Noah", noun: "tulips" },
  reading: { a: "Sofia", b: "Kai", noun: "pages" },
  saving: { a: "Elena", b: "Hugo", noun: "dollars" },
  cards: { a: "Ravi", b: "Maya", noun: "cards" },
  travel: { a: "Chloe", b: "Ben", noun: "blocks" },
  science: { a: "Diego", b: "Amara", noun: "ants" },
  music: { a: "Jonah", b: "Nia", noun: "songs" },
  school: { a: "Leila", b: "Theo", noun: "pencils" },
};

export type GroupScene = {
  /** Plural counted thing, also the counter figure's unit. */
  unit: string;
  one: string;
  /** Singular container. */
  group: string;
  groups: string;
};

/** Situations whose size (2–9) and total (up to 9,999) both stay believable. */
export const groupScenes: Record<string, GroupScene> = {
  sports: {
    unit: "tennis balls",
    one: "tennis ball",
    group: "can",
    groups: "cans",
  },
  pets: { unit: "treats", one: "treat", group: "bowl", groups: "bowls" },
  cooking: { unit: "eggs", one: "egg", group: "carton", groups: "cartons" },
  garden: { unit: "seeds", one: "seed", group: "pot", groups: "pots" },
  reading: { unit: "books", one: "book", group: "bin", groups: "bins" },
  saving: {
    unit: "stickers",
    one: "sticker",
    group: "sheet",
    groups: "sheets",
  },
  cards: { unit: "cards", one: "card", group: "pack", groups: "packs" },
  travel: {
    unit: "postcards",
    one: "postcard",
    group: "bundle",
    groups: "bundles",
  },
  science: { unit: "slides", one: "slide", group: "box", groups: "boxes" },
  music: { unit: "sheets", one: "sheet", group: "folder", groups: "folders" },
  school: { unit: "pencils", one: "pencil", group: "cup", groups: "cups" },
};

const holder = (scene: GroupScene, large: boolean): string => {
  if (!large) {
    const who: Record<string, string> = {
      "tennis balls": "The coach has",
      treats: "Lena has",
      eggs: "The kitchen has",
      seeds: "Noah has",
      books: "The classroom has",
      stickers: "Maya has",
      cards: "Ravi has",
      postcards: "Chloe has",
      slides: "The lab has",
      sheets: "The band has",
      pencils: "The class has",
    };
    return who[scene.unit] ?? "The class has";
  }
  const place: Record<string, string> = {
    "tennis balls": "The tournament desk has",
    treats: "The shelter storeroom has",
    eggs: "A packing plant has",
    seeds: "The garden center has",
    books: "The district library has",
    stickers: "The sticker factory has",
    cards: "The card shop has",
    postcards: "The print shop has",
    slides: "The science museum has",
    sheets: "The music publisher has",
    pencils: "The district office has",
  };
  return place[scene.unit] ?? "The warehouse has";
};

export function groupIntro(
  scene: GroupScene,
  total: string,
  size: string,
  large: boolean,
): string {
  return `${holder(scene, large)} ${total} ${scene.unit}. Each ${scene.group} holds exactly ${size} ${scene.unit}.`;
}

/** A short lead that adds no digits, so an estimate's core sentence still parses. */
export const estimateLead: Record<string, string> = {
  sports: "The coach wants a quick guess.",
  pets: "The shelter is planning supplies.",
  cooking: "The baker wants a quick guess.",
  garden: "The garden club wants a quick guess.",
  reading: "The librarian wants a quick guess.",
  saving: "The class wants a quick guess of the money.",
  cards: "The card club wants a quick guess.",
  travel: "The family wants a quick guess.",
  science: "The lab wants a quick guess.",
  music: "The band wants a quick guess.",
  school: "The teacher wants a quick guess.",
};

export const timesCast: Record<
  string,
  { a: string; b: string; thing: string; verb: string }
> = {
  cooking: { a: "Rosa", b: "Omar", thing: "cookies", verb: "baked" },
  travel: { a: "Chloe", b: "Ben", thing: "postcards", verb: "collected" },
  music: { a: "Jonah", b: "Nia", thing: "songs", verb: "learned" },
  cards: { a: "Ravi", b: "Maya", thing: "cards", verb: "collected" },
  pets: { a: "Lena", b: "Mateo", thing: "treats", verb: "saved" },
  saving: { a: "Elena", b: "Hugo", thing: "dollars", verb: "saved" },
  school: { a: "Leila", b: "Theo", thing: "pencils", verb: "gathered" },
  science: { a: "Diego", b: "Amara", thing: "leaves", verb: "counted" },
  sports: { a: "Jamal", b: "Priya", thing: "points", verb: "scored" },
  garden: { a: "Ava", b: "Noah", thing: "tulips", verb: "planted" },
  reading: { a: "Sofia", b: "Kai", thing: "pages", verb: "read" },
};
