/** AMP's published research, in one place: `/research` renders it, and the
 * build writes the same words into that page's static document for readers
 * that don't run JavaScript (scripts/build-public-documents.ts). Every claim
 * here comes from the report itself; change the report first. */

export type ResearchComponent = {
  title: string;
  what: string;
  research: string;
  sources: string;
};

export const report = {
  title: "Adaptive Math Pathways (AMP): Logic Model and Theory of Change",
  series: "AMP Research Report 2",
  author: "Skylar Saveland",
  orcid: "https://orcid.org/0009-0005-8080-2015",
  affiliation: "Corpora Inc.",
  published: "2026-11-20",
  publishedLabel: "November 2026",
  pages: 27,
  pdf: "/research/amp-rr2-logic-model.pdf",
  /** Set when EdArXiv assigns it; until then the page says it's submitted. */
  doi: null as string | null,
  license: "https://creativecommons.org/licenses/by/4.0/",
  conflict:
    "The author founded Corpora Inc., which develops and sells AMP, and has a financial interest in its evaluation. Every study is pre-registered and published whatever the result.",
  abstract:
    "AMP (Adaptive Math Pathways) is an adaptive mathematics program for kindergarten through precalculus. This report sets out the rationale required for the fourth level of evidence under the Every Student Succeeds Act (ESSA): a logic model, the published research behind each of its links, the outcomes it predicts and how each will be measured, and the planned evaluation. The rationale predicts that using AMP raises mathematics achievement on an independent, nationally normed test, and that gains grow with use.",
  keywords: [
    "adaptive learning",
    "mathematics education",
    "intelligent tutoring systems",
    "logic model",
    "ESSA Tier 4",
    "worked examples",
    "retrieval practice",
    "spaced practice",
    "K-12",
  ],
} as const;

export const researchPage = {
  title: "The research behind AMP",
  lede: "AMP is built on methods with decades of research behind them. Our report sets out each one, the evidence for it, and how we will measure AMP’s effect on a national test.",
  idea: {
    heading: "One class, many levels",
    paragraphs: [
      "Within one grade, math achievement spans years. In grade 8, one standard deviation is about three to four years of typical growth. A lesson taught to the whole class fits only part of the room.",
      "AMP gives each learner practice at their own level, in every area of math, and chooses every next problem from what they just did.",
    ],
  },
  componentsHeading: "What AMP does, and the research behind it",
  components: [
    {
      title: "Practice at the learner’s level",
      what: "AMP keeps an estimate of each learner’s level in every strand of math and aims each problem just within reach.",
      research:
        "Practice that is hard but still successful builds the most lasting learning.",
      sources: "Vygotsky, 1978; Bjork & Bjork, 2011",
    },
    {
      title: "Feedback after every answer",
      what: "Right or wrong, the correct answer, and a worked explanation of the method.",
      research:
        "Feedback about the task and how to do it is among the strongest influences on learning.",
      sources: "Hattie & Timperley, 2007; Shute, 2008",
    },
    {
      title: "Lessons with worked examples",
      what: "Every problem type has a written lesson: the goal, the terms, the steps, the most common mistake and a worked example.",
      research: "Studying worked examples speeds learning in mathematics.",
      sources: "Sweller & Cooper, 1985; Barbieri et al., 2023",
    },
    {
      title: "One-step hints",
      what: "A hint gives the first move, never the answer. An answer helped by a hint doesn’t count toward mastery.",
      research:
        "Support for the part of a task just beyond reach lets a learner finish the rest.",
      sources: "Wood, Bruner & Ross, 1976",
    },
    {
      title: "Mastery, and repair of gaps",
      what: "A skill counts as learned when four of the last five answers are right without help. Repeated misses send practice back to what the skill builds on.",
      research:
        "Mastery learning, with time and correction matched to need, raises achievement.",
      sources: "Bloom, 1968; Kulik, Kulik & Bangert-Drowns, 1990",
    },
    {
      title: "Spaced, mixed review",
      what: "Learned skills come back after six hours, a day, three days, a week, two weeks and a month, mixed in with other topics.",
      research:
        "Retrieval practice and spacing are among the best-supported techniques in the science of learning, and mixed practice beats blocked practice in math.",
      sources:
        "Roediger & Karpicke, 2006; Cepeda et al., 2006; Rohrer & Taylor, 2007; Dunlosky et al., 2013",
    },
    {
      title: "Narrated lesson films",
      what: "Animated worked examples, with the figure drawn in step with the narration.",
      research:
        "Narration timed to the picture it describes supports learning, and animations outperform static pictures on average.",
      sources: "Mayer, 2020; Höffler & Leutner, 2007",
    },
    {
      title: "Progress parents and teachers can see",
      what: "Levels, skills, time and workbooks for parents. For teachers, who needs them today, which students share a gap, and grades that open to their evidence.",
      research:
        "Teachers who monitor progress and adjust instruction raise achievement, and progress information for parents does too.",
      sources: "Fuchs & Fuchs, 1986; Kraft & Rogers, 2015; Bergman, 2021",
    },
    {
      title: "Incentives",
      what: "Points, skill records and celebrations now, and a growing set of incentives that parents and teachers set themselves.",
      research:
        "Game elements improve learning and motivation on average, and immediate rewards work where delayed ones don’t.",
      sources: "Sailer & Homner, 2020; Levitt et al., 2016",
    },
  ] satisfies ResearchComponent[],
  combined:
    "Together these make AMP an adaptive tutoring system, a kind of program with a long record of controlled evaluations (VanLehn, 2011; Kulik & Fletcher, 2016).",
  testing: {
    heading: "How we’re testing it",
    lead: "The report predicts that using AMP raises scores on an independent, nationally normed test, and that gains grow with use. Each study is pre-registered and published whatever the result.",
    phases: [
      {
        name: "Pilot study",
        when: "From 2027",
        what: "Growth on MAP Growth, i-Ready or Star Math against hours of use, with randomized experiments inside AMP.",
      },
      {
        name: "Comparison groups",
        when: "2027–28",
        what: "AMP users against matched classmates who don’t use it, in schools that already test.",
      },
      {
        name: "Randomized trials",
        when: "Fall 2027 at the earliest",
        what: "A lottery decides whether families and schools start AMP now or after the outcome test.",
      },
    ],
  },
  open: {
    heading: "Open to check",
    paragraphs: [
      "Every statement in the report about what AMP does links to AMP’s public source code at a fixed version. Every statement about learning cites published research.",
    ],
  },
  essa: {
    heading: "ESSA Tier 4",
    paragraphs: [
      "The Every Student Succeeds Act sorts evidence for school programs into four tiers. Tier 4, “demonstrates a rationale,” asks for a logic model grounded in research and an ongoing effort to study the program’s effects. This report is AMP’s Tier 4 rationale, and the studies above are designed to reach Tiers 3, 2 and 1.",
    ],
  },
  contact: "skylar@corpora.inc",
} as const;

/** "Saveland, S. (2026). Title. Corpora Inc. https://doi.org/…" */
export function reportCitation(doi: string | null = report.doi) {
  return `Saveland, S. (2026). ${report.title}. ${report.affiliation}${doi ? ` https://doi.org/${doi}` : ""}`;
}

/** Where the report stands at EdArXiv, in a few words. */
export function reportStatus(doi: string | null = report.doi) {
  return doi ? `DOI ${doi}` : "Preprint submitted to EdArXiv";
}
