/** AMP's own side of every comparison, kept once: the side-by-side table's
 * rows with AMP's cell, the hub's categories, and the hub's own words.
 * Every statement is true of the product on main; the prices come from
 * infra/stripe.ts and tests/versus.test.ts holds the price cell to them. */
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
    id: "price",
    label: "Price",
    amp: "$599 a year or $59 a month for the first child, then $399 or $39 for each more. Two parents practice free. Full refund within 30 days.",
  },
  {
    id: "buyers",
    label: "Who can buy",
    amp: "Families, tutors and schools, directly. Free to start without a card: 100 answers and 5 workbooks. Arizona ESA, Arkansas EFA and New Hampshire EFA funds pay for it.",
  },
  {
    id: "range",
    label: "Range",
    amp: "Counting through precalculus in one program: 336 skills on one map.",
  },
  {
    id: "start",
    label: "Finding the starting point",
    amp: "No separate test. Placement takes the first 24 problems of practice. After that, every answer adjusts a level in each of 14 strands of math.",
  },
  {
    id: "teaching",
    label: "Teaching",
    amp: "A one-step hint and a written lesson with a worked example for every problem type. Worked steps after every answer. Narrated lesson films.",
  },
  {
    id: "next",
    label: "What decides the next problem",
    amp: "AMP chooses every problem from the learner’s answers: new work just within reach, a prerequisite, or review.",
  },
  {
    id: "mastery",
    label: "Mastery",
    amp: "Four of the last five answers right without help. An answer after a hint doesn’t count. Two misses in a row send practice back to what the skill builds on.",
  },
  {
    id: "review",
    label: "Review",
    amp: "Scheduled. Learned skills come back after six hours, a day, three days, a week, two weeks and a month, mixed with other topics.",
  },
  {
    id: "print",
    label: "Print",
    amp: "Unlimited workbooks made for each learner, each with a worked answer key. Results entered from paper count.",
  },
  {
    id: "adult",
    label: "What the adult has to do",
    amp: "Nothing to plan, teach or grade. AMP places the learner, chooses each problem, checks it and schedules review.",
  },
  {
    id: "reports",
    label: "Reports",
    amp: "The level in every strand with its likely range, skills, time, and the actual problems behind each number. For teachers, who needs them today.",
  },
  {
    id: "evidence",
    label: "Evidence",
    amp: "A published rationale (ESSA Tier 4) with the research behind each part, public source code, and outcome studies from 2027, each registered before it starts.",
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
  lede: "AMP beside each program families and schools weigh it against. What each does well, what it has proven, and why we built AMP differently. Every fact has a source.",
  /** The strip under the lede: three parts of AMP, each in the research
   * report's own words and linked to its place there. */
  why: {
    heading: "Why AMP",
    components: [
      "level",
      "mastery",
      "review",
    ] satisfies ResearchComponentId[] as readonly ResearchComponentId[],
  },
} as const;

/** Where a correction goes: the founder reads these himself. */
export const versusContact = "skylar@corpora.inc";
