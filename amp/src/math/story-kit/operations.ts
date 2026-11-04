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
  /** Opening that already names who holds the total. */
  lead?: string;
  /** Which of the four question frames to use. */
  frame?: number;
};

/** Situations whose size (2–9) and total (up to 9,999) both stay believable. */
export const groupScenes: Record<string, GroupScene> = {
  sports: {
    unit: "softballs",
    one: "softball",
    group: "bag",
    groups: "bags",
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
  school: { unit: "pencils", one: "pencil", group: "box", groups: "boxes" },
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

/** The larger count is too big for one child to hold, so a place holds it
 * and the question still asks for the named person's smaller amount. */
export function comparisonSmallAsk(
  cast: { a: string; b: string; noun: string },
  large: string,
  factor: string,
): string {
  const { a, b, noun } = cast;
  const place: Record<string, string> = {
    points: `${b}'s team scored ${large} points. That is ${factor} times as many points as ${a} scored. How many points did ${a} score?`,
    fish: `The pet shop has ${large} fish. That is ${factor} times as many fish as ${a} keeps. How many fish does ${a} keep?`,
    cookies: `The bake sale has ${large} cookies. That is ${factor} times as many cookies as ${a} baked. How many cookies did ${a} bake?`,
    tulips: `The garden show has ${large} tulips. That is ${factor} times as many tulips as ${a} planted. How many tulips did ${a} plant?`,
    pages: `${b}'s reading team logged ${large} pages. That is ${factor} times as many pages as ${a} read. How many pages did ${a} read?`,
    dollars: `The fundraiser raised ${large} dollars. That is ${factor} times as many dollars as ${a} saved. How many dollars did ${a} save?`,
    cards: `${b}'s card order has ${large} cards. That is ${factor} times as many cards as ${a} collected. How many cards did ${a} collect?`,
    blocks: `${b}'s family walked ${large} blocks. That is ${factor} times as many blocks as ${a} walked. How many blocks did ${a} walk?`,
    ants: `The science table counted ${large} ants. That is ${factor} times as many ants as ${a} counted. How many ants did ${a} count?`,
    songs: `${b}'s playlist has ${large} songs. That is ${factor} times as many songs as ${a} learned. How many songs did ${a} learn?`,
    pencils: `The supply closet has ${large} pencils for ${b}'s class. That is ${factor} times as many pencils as ${a} has. How many pencils does ${a} have?`,
  };
  return (
    place[noun] ??
    `${b}'s collection has ${large} ${noun}. That is ${factor} times as many ${noun} as ${a} has. How many ${noun} does ${a} have?`
  );
}

const GROUP_ORDER = [
  "pair",
  "can",
  "pack",
  "album page",
  "book",
  "packet",
  "carton",
  "strand",
  "sheet",
  "box",
  "bracelet",
];

/** Group size is the container's real capacity. `who` fits a classroom
 * total; `place` fits a total up to 9,999. */
const REAL_PACKS: Record<
  number,
  { scene: GroupScene; who: string; place: string }[]
> = {
  2: [
    {
      scene: {
        unit: "juice boxes",
        one: "juice box",
        group: "pack",
        groups: "packs",
      },
      who: "The class has",
      place: "The grocery warehouse has",
    },
    {
      scene: {
        unit: "buttons",
        one: "button",
        group: "card",
        groups: "cards",
      },
      who: "The craft table has",
      place: "The button factory has",
    },
  ],
  3: [
    {
      scene: {
        unit: "tennis balls",
        one: "tennis ball",
        group: "can",
        groups: "cans",
      },
      who: "The coach has",
      place: "The sporting-goods warehouse has",
    },
    {
      scene: {
        unit: "juice boxes",
        one: "juice box",
        group: "pack",
        groups: "packs",
      },
      who: "The class has",
      place: "The grocery warehouse has",
    },
  ],
  4: [
    {
      scene: {
        unit: "photos",
        one: "photo",
        group: "album page",
        groups: "album pages",
      },
      who: "Nia has",
      place: "The photo studio has",
    },
    {
      scene: {
        unit: "chairs",
        one: "chair",
        group: "stack",
        groups: "stacks",
      },
      who: "The class has",
      place: "The rental warehouse has",
    },
  ],
  5: [
    {
      scene: {
        unit: "tickets",
        one: "ticket",
        group: "book",
        groups: "books",
      },
      who: "The school play has",
      place: "The ticket office has",
    },
    {
      scene: {
        unit: "seeds",
        one: "seed",
        group: "packet",
        groups: "packets",
      },
      who: "Noah has",
      place: "The garden center has",
    },
  ],
  6: [
    {
      scene: { unit: "eggs", one: "egg", group: "carton", groups: "cartons" },
      who: "The kitchen has",
      place: "The packing plant has",
    },
    {
      scene: {
        unit: "bottles",
        one: "bottle",
        group: "pack",
        groups: "packs",
      },
      who: "The picnic has",
      place: "The bottling plant has",
    },
  ],
  7: [
    {
      scene: {
        unit: "beads",
        one: "bead",
        group: "bracelet",
        groups: "bracelets",
      },
      who: "Lena has",
      place: "The craft shop has",
    },
  ],
  8: [
    {
      scene: {
        unit: "stickers",
        one: "sticker",
        group: "sheet",
        groups: "sheets",
      },
      who: "Maya has",
      place: "The school store has",
    },
    {
      scene: {
        unit: "crayons",
        one: "crayon",
        group: "box",
        groups: "boxes",
      },
      who: "The art table has",
      place: "The supply warehouse has",
    },
  ],
  9: [
    {
      scene: {
        unit: "beads",
        one: "bead",
        group: "strand",
        groups: "strands",
      },
      who: "Lena has",
      place: "The craft shop has",
    },
    {
      scene: {
        unit: "muffins",
        one: "muffin",
        group: "box",
        groups: "boxes",
      },
      who: "The bake sale has",
      place: "The bakery has",
    },
  ],
};

/** A container that really holds `size` items. The telling picks among the
 * containers for that size and does not draw from the problem's numbers. */
export function realisticGroup(
  size: number,
  telling: string,
  large: boolean,
): GroupScene {
  const options = REAL_PACKS[size] ?? REAL_PACKS[8]!;
  const mix = [...telling].reduce((n, ch) => n + ch.charCodeAt(0), 0);
  const chosen = options[mix % options.length]!;
  const lead = large ? chosen.place : chosen.who;
  return { ...chosen.scene, lead, frame: mix % 4 };
}

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
  const frame =
    (((scene.frame ?? GROUP_ORDER.indexOf(scene.group)) % 4) + 4) % 4;
  if (ask === "seats") {
    const question = [
      `What is the fewest ${scene.groups} needed to hold them all?`,
      `How many ${scene.groups} are needed so nothing is left out?`,
      `What is the smallest number of ${scene.groups} that can hold every ${scene.one}?`,
      `How many ${scene.groups} are needed so every ${scene.one} has a place?`,
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
  const who = scene.lead ?? holder(scene, large);
  return `${who} ${total} ${scene.unit}. Each ${scene.group} holds exactly ${size} ${scene.unit}.`;
}

const joinCounts = (nums: readonly string[]) =>
  nums.length === 2
    ? `${nums[0]} and ${nums[1]}`
    : `${nums[0]}, ${nums[1]} and ${nums[2]}`;

/** The counts being estimated are the things in the sentence. The estimation
 * instruction stays after the story so the method is still explicit. */
export function compatibleStory(
  cast: string,
  prompt: string,
): string | undefined {
  const divide = prompt.match(
    /^Estimate (\d+) ÷ (\d+) with compatible numbers\./,
  );
  if (divide) {
    const [D, d] = [divide[1]!, divide[2]!];
    const line: Record<string, string> = {
      sports: `The booster club has ${D} tickets to split among ${d} classes.`,
      pets: `The shelter splits ${D} treats among ${d} dogs.`,
      cooking: `The baker has ${D} rolls to pack into bags of ${d}.`,
      garden: `The garden center has ${D} seeds to put into packets of ${d}.`,
      reading: `The class read ${D} pages across ${d} days.`,
      saving: `The club raised ${D} dollars to share among ${d} classes.`,
      cards: `The shop has ${D} cards to put into packs of ${d}.`,
      travel: `The family drove ${D} miles over ${d} weeks.`,
      science: `The lab has ${D} samples to sort into trays of ${d}.`,
      music: `The band files ${D} pages of music over ${d} days.`,
      school: `The teacher has ${D} stickers to share among ${d} classes.`,
    };
    const story = line[cast];
    return story ? `${story} ${prompt}` : undefined;
  }
  const product = prompt.match(
    /^Estimate (\d+) × (\d+) with compatible numbers\./,
  );
  if (product) {
    const [x, k] = [product[1]!, product[2]!];
    const line: Record<string, string> = {
      sports: `The coach orders ${x} packs with ${k} wristbands in each pack.`,
      pets: `The shelter buys ${x} bags with ${k} treats in each bag.`,
      cooking: `The baker fills ${x} trays with ${k} rolls on each tray.`,
      garden: `The garden center fills ${x} packets with ${k} seeds in each packet.`,
      reading: `The library loads ${x} carts with ${k} books on each cart.`,
      saving: `The fundraiser stacks ${x} sheets with ${k} stickers on each sheet.`,
      cards: `The card shop opens ${x} boxes with ${k} cards in each box.`,
      travel: `The school bus drove ${k} miles on each of ${x} school days.`,
      science: `The lab lines up ${x} trays with ${k} slides on each tray.`,
      music: `The band sets out ${x} folders with ${k} sheets in each folder.`,
      school: `The teacher orders ${x} boxes with ${k} pencils in each box.`,
    };
    const story = line[cast];
    return story ? `${story} ${prompt}` : undefined;
  }
  const front = prompt.match(
    /^Use front-end estimation to estimate ([\d, +]+)\./,
  );
  if (front) {
    const nums = front[1]!.split(" + ");
    const list = joinCounts(nums);
    const span = nums.length === 2 ? "two" : "three";
    const line: Record<string, string> = {
      sports: `The club sold ${list} tickets across ${span} games.`,
      pets: `The shelter used ${list} cups of food over ${span} weeks.`,
      cooking: `The bakery sold ${list} cookies over ${span} days.`,
      garden: `The garden center packed ${list} seeds over ${span} days.`,
      reading: `The school read ${list} pages over ${span} weeks.`,
      saving: `The fundraiser raised ${list} dollars over ${span} weeks.`,
      cards: `The card shop sold ${list} cards over ${span} days.`,
      travel: `The bus fleet drove ${list} miles over ${span} weeks.`,
      science: `The science fair counted ${list} visitors over ${span} days.`,
      music: `The band collected ${list} box tops over ${span} weeks.`,
      school: `The school collected ${list} cans in ${span} weeks.`,
    };
    const story = line[cast];
    return story ? `${story} ${prompt}` : undefined;
  }
  return undefined;
}

export const timesCast: Record<
  string,
  { a: string; b: string; thing: string; verb: string }
> = {
  cooking: { a: "Rosa", b: "Omar", thing: "cookies", verb: "baked" },
  travel: { a: "Chloe", b: "Ben", thing: "postcards", verb: "collected" },
  music: { a: "Jonah", b: "Nia", thing: "songs", verb: "learned" },
  cards: { a: "Ravi", b: "Maya", thing: "cards", verb: "collected" },
  pets: { a: "Lena", b: "Mateo", thing: "stickers", verb: "saved" },
  saving: { a: "Elena", b: "Hugo", thing: "dollars", verb: "saved" },
  school: { a: "Leila", b: "Theo", thing: "pencils", verb: "gathered" },
  science: { a: "Diego", b: "Amara", thing: "leaves", verb: "counted" },
  sports: { a: "Jamal", b: "Priya", thing: "points", verb: "scored" },
  garden: { a: "Ava", b: "Noah", thing: "tulips", verb: "planted" },
  reading: { a: "Sofia", b: "Kai", thing: "pages", verb: "read" },
};
