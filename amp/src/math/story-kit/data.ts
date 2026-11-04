/**
 * Grade-4 data contexts: objects a 9- or 10-year-old measures or counts,
 * with units and ranges that fit the object. Reusable by later grades.
 * Learner names come from ./names, not from this file.
 */

/** Lengths from 1 to 4 inches, the window of the grade-4 line plots.
 * Halves, quarters, and eighths are the marks on a classroom ruler. */
export const lengthMeasures = [
  {
    item: "crayon",
    items: "crayons",
    place: "from the art bin",
    purpose: "for a still-life drawing",
  },
  {
    item: "seedling",
    items: "seedlings",
    place: "in the garden bed",
    purpose: "to see how the bean plants had grown",
  },
  {
    item: "earthworm",
    items: "earthworms",
    place: "from the garden soil",
    purpose: "during a science dig",
  },
  {
    item: "leaf",
    items: "leaves",
    place: "on the nature walk",
    purpose: "for a leaf collection",
  },
  {
    item: "screw",
    items: "screws",
    place: "from the hardware jar",
    purpose: "for a birdhouse",
  },
  {
    item: "ribbon",
    items: "ribbons",
    place: "for the bookmarks",
    purpose: "before the book fair",
  },
  {
    item: "chalk piece",
    items: "chalk pieces",
    place: "in the art tray",
    purpose: "before art class",
  },
  {
    item: "feather",
    items: "feathers",
    place: "found on the playground",
    purpose: "for a nature display",
  },
  {
    item: "carrot stick",
    items: "carrot sticks",
    place: "for the snack bags",
    purpose: "before lunch",
  },
  {
    item: "twig",
    items: "twigs",
    place: "for a nest model",
    purpose: "in the craft room",
  },
  {
    item: "eraser",
    items: "erasers",
    place: "from the pencil cup",
    purpose: "during a desk cleanup",
  },
  {
    item: "paper strip",
    items: "paper strips",
    place: "for a collage",
    purpose: "in art class",
  },
] as const;

export type LengthMeasure = (typeof lengthMeasures)[number];

/** Who was counted, and what number was recorded about them.
 * A count of 0 is possible (nobody scored, nobody read yet). */
export const frequencyTales = [
  {
    one: "student",
    many: "students",
    measured: "pages read this month",
    each: "how many pages one student read this month",
    widths: [10, 25, 50, 100],
    lead: (name: string) =>
      `${name} listed how many pages each student in the reading club had read this month.`,
  },
  {
    one: "player",
    many: "players",
    measured: "points scored this season",
    each: "how many points one player scored this season",
    widths: [10, 25, 50],
    lead: (name: string) =>
      `${name} wrote down the points each player scored this season.`,
  },
  {
    one: "student",
    many: "students",
    measured: "minutes of piano practice this week",
    each: "how many minutes one student practiced piano this week",
    widths: [5, 10, 25],
    lead: (name: string) =>
      `${name} recorded how many minutes each student practiced piano this week.`,
  },
  {
    one: "runner",
    many: "runners",
    measured: "laps run at practice",
    each: "how many laps one runner finished at practice",
    widths: [5, 10],
    lead: (name: string) =>
      `${name} counted the laps each runner finished at practice.`,
  },
  {
    one: "class",
    many: "classes",
    measured: "cans collected for the food drive",
    each: "how many cans one class collected",
    widths: [10, 25, 50, 100],
    lead: (name: string) =>
      `${name} listed how many cans each class brought for the food drive.`,
  },
  {
    one: "student",
    many: "students",
    measured: "points on the quiz",
    each: "how many points one student scored on the quiz",
    widths: [5, 10],
    lead: (name: string) =>
      `${name} listed the quiz score of each student in the class.`,
  },
  {
    one: "student",
    many: "students",
    measured: "minutes spent reading last night",
    each: "how many minutes one student read last night",
    widths: [5, 10, 25],
    lead: (name: string) =>
      `${name} asked each student how many minutes they read last night.`,
  },
  {
    one: "gardener",
    many: "gardeners",
    measured: "plants sold at the garden sale",
    each: "how many plants one gardener sold",
    widths: [5, 10, 25],
    lead: (name: string) =>
      `${name} counted how many plants each gardener sold at the sale.`,
  },
  {
    one: "rider",
    many: "riders",
    measured: "miles biked this month",
    each: "how many miles one rider biked this month",
    widths: [10, 25],
    lead: (name: string) =>
      `${name} listed how many miles each rider biked this month.`,
  },
  {
    one: "student",
    many: "students",
    measured: "stickers earned in the reading challenge",
    each: "how many stickers one student earned",
    widths: [5, 10, 25],
    lead: (name: string) =>
      `${name} counted the stickers each student earned in the reading challenge.`,
  },
  {
    one: "baker",
    many: "bakers",
    measured: "cookies brought to the bake sale",
    each: "how many cookies one baker brought",
    widths: [10, 25],
    lead: (name: string) =>
      `${name} counted how many cookies each baker brought to the bake sale.`,
  },
  {
    one: "player",
    many: "players",
    measured: "baskets made at camp",
    each: "how many baskets one player made at camp",
    widths: [5, 10],
    lead: (name: string) =>
      `${name} recorded how many baskets each player made at basketball camp.`,
  },
] as const;

export type FrequencyTale = (typeof frequencyTales)[number];

/** One word per category so the question can name the bars.
 * `steps` are the side-scales that fit the count. */
export const barTales = [
  {
    labels: ["Oak", "Pine", "Maple", "Birch"],
    unit: "books",
    one: "book",
    steps: [5, 10, 25],
    lead: "Four homerooms counted the books they read this month.",
  },
  {
    labels: ["Lincoln", "Rivera", "Harper", "Grant"],
    unit: "books",
    one: "book",
    steps: [50, 100],
    lead: "Four schools counted the books collected in the book drive.",
  },
  {
    labels: ["Red", "Blue", "Gold", "Green"],
    unit: "cans",
    one: "can",
    steps: [10, 25, 50, 100],
    lead: "Four teams collected cans for the food drive.",
  },
  {
    labels: ["Chess", "Robot", "Drama", "Garden"],
    unit: "students",
    one: "student",
    steps: [5, 10, 25],
    lead: "Students signed up for four after-school clubs.",
  },
  {
    labels: ["North", "South", "East", "West"],
    unit: "stickers",
    one: "sticker",
    steps: [5, 10, 25, 50],
    lead: "Four teams earned stickers during the reading challenge.",
  },
  {
    labels: ["Dogs", "Cats", "Birds", "Fish"],
    unit: "votes",
    one: "vote",
    steps: [5, 10],
    lead: "The fourth grade voted for a pet to visit the classroom.",
  },
  {
    labels: ["Hawks", "Bears", "Lions", "Wolves"],
    unit: "points",
    one: "point",
    steps: [5, 10, 25],
    lead: "Four teams scored points at field day.",
  },
  {
    labels: ["Band", "Choir", "Art", "Dance"],
    unit: "tickets",
    one: "ticket",
    steps: [10, 25, 50],
    lead: "Four groups sold tickets to the spring show.",
  },
  {
    labels: ["Sugar", "Oatmeal", "Chocolate", "Lemon"],
    unit: "cookies",
    one: "cookie",
    steps: [10, 25, 50],
    lead: "Four tables sold cookies at the bake sale.",
  },
  {
    labels: ["Lake", "Ridge", "Creek", "Mesa"],
    unit: "miles",
    one: "mile",
    steps: [5, 10],
    lead: "The hiking club recorded miles walked on four trails.",
  },
  {
    labels: ["Basil", "Mint", "Thyme", "Sage"],
    unit: "plants",
    one: "plant",
    steps: [5, 10, 25],
    lead: "The garden club counted plants in four herb beds.",
  },
  {
    labels: ["Ada", "Boone", "Clay", "Davis"],
    unit: "cans",
    one: "can",
    steps: [50, 100],
    lead: "Four neighborhoods collected cans for recycling week.",
  },
] as const;

export type BarTale = (typeof barTales)[number];
