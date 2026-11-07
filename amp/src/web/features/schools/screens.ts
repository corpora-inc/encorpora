/** The product screens `/schools` shows, in one list. Each comes wide and narrow
 * (a phone shows the phone's own screen), light and dark. A later capture from
 * seeded data replaces the files; this list is the only thing that names them. */
const files = import.meta.glob<string>("./screens/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

type Size = { width: number; height: number };
export type ProductScreen = {
  id: string;
  alt: string;
  wide: Size;
  narrow: Size;
};
export const productScreens = {
  board: {
    id: "board",
    alt: "The Start class board: a large class code and QR code, with each student’s name lighting up as they arrive.",
    wide: { width: 1280, height: 900 },
    narrow: { width: 390, height: 830 },
  },
  cards: {
    id: "cards",
    alt: "A printed sheet of sign-in cards, one for each student, with a QR code on every card.",
    wide: { width: 752, height: 500 },
    narrow: { width: 390, height: 500 },
  },
  today: {
    id: "today",
    alt: "Today for a class: six students stuck on fraction addition with a lesson to teach, one student to sit with, two behind on time, one ready for more, then the week’s numbers and the class map.",
    wide: { width: 1280, height: 1500 },
    narrow: { width: 780, height: 1688 },
  },
  gradebook: {
    id: "gradebook",
    alt: "A quarter’s gradebook: a suggested grade range for each student, the four things it’s built from, and a box for the final grade.",
    wide: { width: 1280, height: 900 },
    narrow: { width: 780, height: 1688 },
  },
  evidence: {
    id: "evidence",
    alt: "One student’s grade opened: why it’s A minus to A plus, the objectives gained with their dates, and the problems behind them.",
    wide: { width: 500, height: 900 },
    narrow: { width: 780, height: 1688 },
  },
  stack: {
    id: "stack",
    alt: "The workbook stack: choose a date, a length and a paper size, and print 24 different workbooks for 24 students.",
    wide: { width: 1280, height: 1011 },
    narrow: { width: 390, height: 860 },
  },
  standings: {
    id: "standings",
    alt: "A class board of the top ten students by growth this term, with one student’s own line highlighted.",
    wide: { width: 720, height: 1075 },
    narrow: { width: 390, height: 900 },
  },
} as const satisfies Record<string, ProductScreen>;

/** The file for a screen, falling back to light where there's no dark capture. */
export function screenFile(
  id: string,
  shape: "wide" | "narrow",
  theme: "light" | "dark",
): string | undefined {
  return files[`./screens/${id}-${shape}-${theme}.webp`];
}
