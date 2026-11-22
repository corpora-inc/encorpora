/** AMP's own side of every comparison, kept once: the side-by-side table's
 * rows with AMP's cell, the hub's categories, and the hub's own words.
 * Every statement is true of the product on main. The comparisons are about
 * philosophy and rationale: how each program thinks a learner learns math,
 * and why AMP's way is better. They are written to last: never price, never
 * who sells to whom, never one of AMP's settings or counts (validate.ts
 * refuses price and settings). */
import type { ResearchComponentId } from "../research/report";
import type { VersusCategory, VersusRowId } from "./types";

export type VersusRow = {
  id: VersusRowId;
  /** The row's name, the same on every page. */
  label: string;
  /** AMP's cell. */
  amp: string;
};

/** In the order the table shows them. A page shows the rows its own file
 * has a cell for. */
export const versusRows: readonly VersusRow[] = [
  {
    id: "range",
    label: "Range",
    amp: "Counting through precalculus in one program, on one map of skills.",
  },
  {
    id: "start",
    label: "Finding the starting point",
    amp: "No separate test. Assessment is continuous: AMP places the learner from their first answers, and every answer after updates a level in each part of math.",
  },
  {
    id: "teaching",
    label: "Teaching",
    amp: "At the problem. Each one carries a hint that gives the first step, a lesson with a worked example, a film where there is one, and the worked answer.",
  },
  {
    id: "next",
    label: "What decides the next problem",
    amp: "The learner’s own answers: new work just within reach, a gap to close, or an old skill due back.",
  },
  {
    id: "mastery",
    label: "What counts as learned",
    amp: "Right without help, more than once. An answer after a hint doesn’t count.",
  },
  {
    id: "review",
    label: "Review",
    amp: "Continuous. Learned skills come back in ordinary practice, at growing intervals, mixed with other math.",
  },
  {
    id: "print",
    label: "Paper",
    amp: "Workbooks made for each learner, with worked answer keys. Work done on paper counts.",
  },
  {
    id: "adult",
    label: "The adult’s part",
    amp: "No planning, teaching or grading. AMP places the learner, chooses each problem, checks it and schedules review.",
  },
  {
    id: "reports",
    label: "What the adult sees",
    amp: "A level for each part of math, and the actual problems behind every number.",
  },
  {
    id: "evidence",
    label: "Evidence",
    amp: "A published rationale with the research behind each part, public source code, and outcome studies registered before they start.",
  },
];

export type VersusCategoryInfo = {
  id: VersusCategory;
  title: string;
  /** One line under the title on the hub. */
  blurb: string;
  /** The words after the name in a page's title, unless the page has its
   * own (`VersusPage.benefit`): "AMP vs i-Ready: <benefit> | AMP". */
  benefit: string;
};

/** In the order the hub shows them. */
export const versusCategories: readonly VersusCategoryInfo[] = [
  {
    id: "adaptive",
    title: "Adaptive practice programs",
    blurb: "Programs that choose practice from a learner’s answers.",
    benefit: "Every answer sets the next",
  },
  {
    id: "school",
    title: "Programs schools assign",
    blurb: "Programs a student meets through a school or a district.",
    benefit: "Adapts at every answer",
  },
  {
    id: "courses",
    title: "Online courses and video lessons",
    blurb: "A teacher on video, then practice.",
    benefit: "Practice that adapts",
  },
  {
    id: "all-in-one",
    title: "All-in-one homeschool programs and online schools",
    blurb: "Every subject in one subscription, math among them.",
    benefit: "Math at the learner’s level",
  },
  {
    id: "books",
    title: "Books and workbooks",
    blurb: "Printed curricula an adult teaches from.",
    benefit: "Practice that checks itself",
  },
  {
    id: "games",
    title: "Math games",
    blurb: "Practice inside a game.",
    benefit: "Every minute is math",
  },
  {
    id: "tutoring",
    title: "Tutors and learning centers",
    blurb: "A person or a center, by the hour or the month.",
    benefit: "Daily practice at home",
  },
  {
    id: "ai",
    title: "AI tutors and homework apps",
    blurb: "Chat tutors, and apps that solve a photographed problem.",
    benefit: "Teaching, not just answers",
  },
];

export function versusCategory(id: VersusCategory): VersusCategoryInfo {
  const found = versusCategories.find((category) => category.id === id);
  if (!found) throw new Error(`No comparison category: ${id}`);
  return found;
}

/** The hub's own words (`/versus`). */
export const versusHub = {
  title: "AMP vs other math programs",
  lede: "In AMP, assessment, teaching and review are continuous: they happen at every problem. Here is that design beside each of the other programs, with sources.",
  /** Under the lede: the case for AMP in three claims, each a door to its
   * research. Principles, never settings: a threshold or an interval can
   * change, and no reader chooses a program by one. */
  why: {
    heading: "Why AMP",
    reasons: [
      {
        title: "Continuous assessment",
        text: "There is no test day. Every answer updates the learner’s level in that part of math and sets the next problem.",
        research: "level",
      },
      {
        title: "The problem is the unit",
        text: "Each problem carries its hint, its lesson, a film where there is one, the worked answer, and the skills it builds on and leads to.",
        research: "lessons",
      },
      {
        title: "Continuous review",
        text: "Learned skills come back in ordinary practice, at growing intervals, mixed with other math.",
        research: "review",
      },
    ] satisfies readonly {
      title: string;
      text: string;
      research: ResearchComponentId;
    }[],
  },
} as const;

/** Where a correction goes: the founder reads these himself. */
export const versusContact = "skylar@corpora.inc";
