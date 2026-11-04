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
    unit: "softballs",
    one: "softball",
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
      softballs: "The coach has",
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
    softballs: "The tournament desk has",
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

/** Larger-unknown comparison, with a verb that fits the noun. */
export function comparisonAsk(
  cast: { a: string; b: string; noun: string },
  small: string,
  factor: string,
): string {
  const { a, b, noun } = cast;
  if (noun === "points")
    return `${a} scored ${small} points. ${b} scored ${factor} times as many points. How many points did ${b} score?`;
  if (noun === "pages")
    return `${a} read ${small} pages. ${b} read ${factor} times as many pages. How many pages did ${b} read?`;
  if (noun === "dollars")
    return `${a} saved ${small} dollars. ${b} saved ${factor} times as many dollars. How many dollars did ${b} save?`;
  if (noun === "cookies")
    return `${a} baked ${small} cookies. ${b} baked ${factor} times as many cookies. How many cookies did ${b} bake?`;
  if (noun === "tulips")
    return `${a} planted ${small} tulips. ${b} planted ${factor} times as many tulips. How many tulips did ${b} plant?`;
  if (noun === "blocks")
    return `${a} walked ${small} blocks. ${b} walked ${factor} times as many blocks. How many blocks did ${b} walk?`;
  if (noun === "songs")
    return `${a} learned ${small} songs. ${b} learned ${factor} times as many songs. How many songs did ${b} learn?`;
  if (noun === "ants")
    return `${a} counted ${small} ants. ${b} counted ${factor} times as many ants. How many ants did ${b} count?`;
  if (noun === "fish")
    return `${a} has ${small} fish. ${b} has ${factor} times as many fish. How many fish does ${b} have?`;
  if (noun === "cards")
    return `${a} collected ${small} cards. ${b} collected ${factor} times as many cards. How many cards does ${b} have?`;
  return `${a} has ${small} ${noun}. ${b} has ${factor} times as many ${noun} as ${a}. How many ${noun} does ${b} have?`;
}

const GROUP_ORDER = [
  "can",
  "bowl",
  "carton",
  "pot",
  "bin",
  "sheet",
  "pack",
  "bundle",
  "box",
  "folder",
  "cup",
];

/** Four question frames, chosen from the container so a set of scenes does not
 * share one sentence. */
export function groupQuestion(
  scene: GroupScene,
  total: string,
  size: string,
  large: boolean,
  ask: "full" | "left" | "seats",
): string {
  const intro = groupIntro(scene, total, size, large);
  const frame = GROUP_ORDER.indexOf(scene.group) % 4;
  if (ask === "seats") {
    const question = [
      `What is the fewest ${scene.groups} needed to hold them all?`,
      `How many ${scene.groups} are needed so nothing is left out?`,
      `What is the smallest number of ${scene.groups} that can hold every ${scene.one}?`,
      `How many ${scene.groups} should be ready so every ${scene.one} has a place?`,
    ][frame]!;
    return `${intro} ${question}`;
  }
  if (ask === "left") {
    const question = [
      `After filling as many ${scene.groups} as possible, how many ${scene.unit} are left?`,
      `How many ${scene.unit} are left over?`,
      `How many ${scene.unit} do not fit in a full ${scene.group}?`,
      `What is left after the full ${scene.groups} are filled?`,
    ][frame]!;
    return `${intro} ${question}`;
  }
  const question = [
    `How many full ${scene.groups} can be filled?`,
    `How many complete ${scene.groups} can be packed?`,
    `What is the greatest number of full ${scene.groups}?`,
    `How many ${scene.groups} can be finished?`,
  ][frame]!;
  return `${intro} ${question}`;
}

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
  sports: "The coach checks the equipment order before practice.",
  pets: "The shelter is about to order more supplies.",
  cooking: "The baker plans the morning bake.",
  garden: "The garden club plans a planting day.",
  reading: "The librarian plans the book carts.",
  saving: "The class plans how far the fundraiser money will go.",
  cards: "The card club plans packs for the tournament.",
  travel: "The family plans the drive.",
  science: "The lab plans trays for the fair.",
  music: "The band plans folders for the concert.",
  school: "The teacher plans cups of pencils for the tables.",
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
