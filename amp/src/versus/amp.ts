/** AMP's own side of every comparison, kept once: the side-by-side table's
 * rows with AMP's cell, the hub's categories, and the hub's own words.
 * The wording here is a first draft drawn from the research report
 * (src/research/report.ts), the homepage and the prices (infra/stripe.ts);
 * tests/versus.test.ts holds the price cell to the prices on sale. */
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
    amp: "$599 a year or $59 a month. Free to try without a card: 100 problems and 5 workbooks.",
  },
  {
    id: "buyers",
    label: "Who can buy",
    amp: "Families and schools, directly. Arizona ESA, Arkansas EFA and New Hampshire EFA funds pay for it too.",
  },
  {
    id: "range",
    label: "Range",
    amp: "Counting through precalculus, in one program.",
  },
  {
    id: "start",
    label: "Finding the starting point",
    amp: "AMP estimates the learner’s level in every strand of math from their answers.",
  },
  {
    id: "teaching",
    label: "Teaching",
    amp: "A written lesson with a worked example for every problem type, a worked explanation after every answer, and narrated lesson films.",
  },
  {
    id: "next",
    label: "What decides the next problem",
    amp: "AMP chooses every next problem from what the learner just did, aimed just within reach.",
  },
  {
    id: "mastery",
    label: "Mastery",
    amp: "Four of the last five answers right without help. Repeated misses send practice back to what the skill builds on.",
  },
  {
    id: "review",
    label: "Review",
    amp: "Learned skills come back after six hours, a day, three days, a week, two weeks and a month, mixed in with other topics.",
  },
  {
    id: "print",
    label: "Print",
    amp: "Unlimited printable workbooks, made for each learner.",
  },
  {
    id: "adult",
    label: "What the adult has to do",
    amp: "Nothing to plan. The learner presses Next.",
  },
  {
    id: "reports",
    label: "Reports",
    amp: "Levels, skills, time and workbooks for parents. For teachers, who needs them today and which students share a gap.",
  },
  {
    id: "evidence",
    label: "Evidence",
    amp: "A published ESSA Tier 4 report: the research behind each part of AMP, and pre-registered studies from 2027.",
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
    benefit: "Every Next Problem Chosen",
  },
  {
    id: "school",
    title: "Programs schools assign",
    blurb: "Programs a child meets through a school or a district.",
    benefit: "Math Families Can Buy",
  },
  {
    id: "courses",
    title: "Online courses and video lessons",
    blurb: "A teacher on video, then practice.",
    benefit: "Practice That Adapts",
  },
  {
    id: "all-in-one",
    title: "All-in-one homeschool programs and online schools",
    blurb: "Every subject in one subscription, math among them.",
    benefit: "Math at the Learner’s Level",
  },
  {
    id: "books",
    title: "Books and workbooks",
    blurb: "Printed curricula a parent teaches from.",
    benefit: "Workbooks That Adapt",
  },
  {
    id: "games",
    title: "Math games",
    blurb: "Practice inside a game.",
    benefit: "Math That Builds Mastery",
  },
  {
    id: "tutoring",
    title: "Tutors and learning centers",
    blurb: "A person or a center, by the hour or the month.",
    benefit: "Daily Practice at Home",
  },
  {
    id: "ai",
    title: "AI tutors and homework apps",
    blurb: "Chat tutors, and apps that solve a photographed problem.",
    benefit: "Teaching, Not Just Answers",
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
  lede: "Every math program makes a choice about what a child does next. Here is how AMP’s differs from each, with sources.",
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
