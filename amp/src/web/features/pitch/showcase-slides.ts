/** The slides beside Try it free at `/`, in order. Each is a capture of the
 * real app or a real printed workbook (`scripts/capture-pitch-showcase.ts`
 * makes the files in ./showcase/, wide and narrow, light and dark). This list
 * is the only thing that names them; the home document preloads the first
 * (`scripts/build-home-document.ts`). */
export type ShowcaseSlide = {
  id: string;
  /** "app": a screen of practice; "paper": workbook pages, shown as paper. */
  kind: "app" | "paper";
  /** The slide's name for its control and its place in the carousel. */
  label: string;
  alt: string;
};

export const showcaseSlides: readonly ShowcaseSlide[] = [
  {
    id: "area-model",
    kind: "app",
    label: "Multiplying with partial products",
    alt: "AMP practice: 49 × 56 with an area model, answered correctly, a step up to grade 4, with its worked explanation and the skill's strength.",
  },
  {
    id: "fraction-line",
    kind: "app",
    label: "Fractions on a number line",
    alt: "AMP practice: a grade 3 problem asking which number a point on a number line marks.",
  },
  {
    id: "workbook",
    kind: "paper",
    label: "A printed workbook",
    alt: "Two pages of a printed AMP workbook: the first page, with its sections and warm-up problems, and the worked answer key.",
  },
  {
    id: "graph",
    kind: "app",
    label: "Slope of a line",
    alt: "AMP practice: a step up to grade 8, finding the slope of a line through two points on a coordinate grid.",
  },
  {
    id: "box-plot",
    kind: "app",
    label: "Comparing two data distributions",
    alt: "AMP practice: two box plots of class test scores, answered correctly, a step up to grade 7, with the worked explanation.",
  },
];

/** The captures' pixel sizes. Wide is the app side by side at 16:9; narrow
 * is the phone’s own layout at 9:16. Workbook pages are US letter. */
export const showcaseSizes = {
  wide: { width: 1600, height: 900 },
  narrow: { width: 600, height: 1066 },
  page: { width: 680, height: 880 },
} as const;
