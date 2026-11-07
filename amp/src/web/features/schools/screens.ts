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
    narrow: { width: 780, height: 1688 },
  },
  cards: {
    id: "cards",
    alt: "A printed sheet of sign-in cards, one for each student, with a QR code on every card.",
    wide: { width: 720, height: 500 },
    narrow: { width: 780, height: 1688 },
  },
  today: {
    id: "today",
    alt: "Today for a class: groups of students stuck on the same idea, each with a lesson to teach and a group sheet to print, a student to sit with, who’s behind this week’s target and a good day, then the week’s numbers and the class map.",
    wide: { width: 1280, height: 1500 },
    narrow: { width: 780, height: 1688 },
  },
  gradebook: {
    id: "gradebook",
    alt: "A semester’s gradebook: a suggested grade range for each student, the four things it’s built from, and a box for the final grade.",
    wide: { width: 1280, height: 900 },
    narrow: { width: 780, height: 1688 },
  },
  evidence: {
    id: "evidence",
    alt: "One student’s grade opened: why the suggested range, the four things behind it, and the objectives gained with their dates.",
    wide: { width: 500, height: 900 },
    narrow: { width: 780, height: 1688 },
  },
  stack: {
    id: "stack",
    alt: "The workbook stack: choose a date, a length and a paper size, and print 30 different workbooks for 30 students.",
    wide: { width: 1280, height: 900 },
    narrow: { width: 780, height: 1688 },
  },
  standings: {
    id: "standings",
    alt: "A class board of the top ten students by growth this term, with one student’s own line highlighted.",
    wide: { width: 720, height: 1184 },
    narrow: { width: 780, height: 1688 },
  },
  schoolOverview: {
    id: "school-overview",
    alt: "A school’s overview: how many students practiced this week, seats in use, what needs attention, weekly minutes this term, and where students stand against their own grade.",
    wide: { width: 1280, height: 900 },
    narrow: { width: 780, height: 1688 },
  },
  districtOverview: {
    id: "district-overview",
    alt: "A district’s overview: the same morning read across twelve schools, with each school’s practice and growth in one table.",
    wide: { width: 1280, height: 900 },
    narrow: { width: 780, height: 1688 },
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
