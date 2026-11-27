/** The data dictionary of a research extract. One definition drives each
 * file's CSV header and the codebook that ships inside every extract, so the
 * two never disagree (docs/research-export.md). */

export type ColumnType = "id" | "integer" | "number" | "boolean" | "text";
export type Column = {
  name: string;
  type: ColumnType;
  description: string;
  /** The values a text column takes, when it is a closed set. */
  values?: readonly string[];
};
export type FileSpec = {
  name: string;
  description: string;
  /** What one row is. */
  row: string;
  columns: readonly Column[];
};

/** Bumped when a file, column or meaning changes. */
export const EXTRACT_VERSION = 1;

const learner: Column = {
  name: "study_learner_id",
  type: "id",
  description:
    "The participant's study ID: stable within this study, different in every other study.",
};
const family: Column = {
  name: "study_family_id",
  type: "id",
  description: "The participant's household. Siblings in one study share it.",
};
const week: Column = {
  name: "week",
  type: "integer",
  description:
    "Instructional week: 1 is the participant's first seven days from enrolment, counted in the learner's local calendar days.",
};
const seconds = (what: string): Column => ({
  name: `${what}_seconds`,
  type: "integer",
  description: `Active seconds on ${what === "active" ? "every AMP screen" : `the ${what} surface`} that week (the heartbeat's measure: visible, recently used, capped per beat).`,
});
const opened = (name: string, what: string): Column => ({
  name,
  type: "integer",
  description: `${what} that week.`,
});
const flag = (name: string, description: string): Column => ({
  name,
  type: "boolean",
  description,
});

export const EXTRACT_FILES = [
  {
    name: "participants.csv",
    description: "Every enrolled participant who has not withdrawn.",
    row: "One participant.",
    columns: [
      learner,
      family,
      {
        name: "current_week",
        type: "integer",
        description:
          "The instructional week the participant was in when the extract was made.",
      },
    ],
  },
  {
    name: "answers.csv",
    description:
      "Every problem AMP served the participant from enrolment on, with its answer when there is one. Paper workbook answers scored in the app are included (evidence_source paper).",
    row: "One problem served.",
    columns: [
      learner,
      {
        name: "sequence",
        type: "integer",
        description:
          "Order in which the participant's problems were served, from 1.",
      },
      {
        ...week,
        description: `${week.description} The week the problem was served.`,
      },
      {
        name: "skill_id",
        type: "id",
        description: "The skill the problem practises (see skills.csv).",
      },
      {
        name: "template_id",
        type: "id",
        description: "The problem type (generator) the problem came from.",
      },
      {
        name: "selection_reason",
        type: "text",
        description:
          "Why the adaptive engine chose it (for example review for spaced review). Empty when not recorded.",
      },
      {
        name: "selection_strand",
        type: "text",
        description:
          "The engine strand it was chosen for. Empty when not recorded.",
      },
      {
        name: "policy_version",
        type: "text",
        description:
          "The practice policy version that chose it. Empty when not recorded.",
      },
      flag(
        "working_together",
        "Served while an adult had marked the session as working together.",
      ),
      {
        name: "outcome",
        type: "text",
        description:
          "answered; skipped (the answer was shown without an answer); or unanswered (served, not yet answered when the extract was made).",
        values: ["answered", "skipped", "unanswered"],
      },
      flag("correct", "The answer was right. Empty unless answered."),
      {
        name: "parts_correct",
        type: "integer",
        description:
          "Multi-part problems: parts answered right. Empty for single-part problems.",
      },
      {
        name: "parts_total",
        type: "integer",
        description:
          "Multi-part problems: number of parts. Empty for single-part problems.",
      },
      flag(
        "assisted",
        "A hint or lesson was opened, or an adult worked it together, before the answer.",
      ),
      flag(
        "independent",
        "Right, unassisted and full-weight evidence: what AMP counts as independent success.",
      ),
      flag("help_hint", "A hint was opened on this problem."),
      flag("help_lesson", "The lesson was opened on this problem."),
      flag("help_video", "A video was opened on this problem."),
      flag("help_example", "A worked example was opened on this problem."),
      flag("help_adult", "An adult helped in person (working together)."),
      {
        name: "evidence_source",
        type: "text",
        description:
          "app (answered on screen) or paper (a printed workbook answer scored in the app). Empty unless answered.",
        values: ["app", "paper"],
      },
      {
        name: "evidence_weight",
        type: "number",
        description:
          "Weight of the answer as evidence: 1 for a graded answer, below 1 for a weaker mark (a parent's mark without the answer). Empty unless answered.",
      },
      {
        name: "seconds_to_answer",
        type: "number",
        description:
          "Seconds from serving to the answer, to 0.1 s. Empty for paper answers and problems not answered.",
      },
      {
        name: "learner_level",
        type: "number",
        description:
          "The learner's overall working level as it stood at the end of the last day before the problem was served (grade scale: K = 0, grade 8 = 8, Algebra 1 = 9, Geometry = 10, Algebra 2 = 11, Precalculus = 12), so it never reflects this answer or later ones. Empty when no earlier level was stored.",
      },
    ],
  },
  {
    name: "workbooks.csv",
    description:
      "Printable workbooks made for the participant from enrolment on.",
    row: "One workbook.",
    columns: [
      learner,
      { ...week, description: `${week.description} The week it was made.` },
      {
        name: "number",
        type: "integer",
        description:
          "1 for the day's first workbook, 2 for another that day, and so on.",
      },
      {
        name: "minutes",
        type: "integer",
        description: "The length chosen: 30, 45 or 60 minutes.",
      },
      { name: "sections", type: "integer", description: "Sections in it." },
      {
        name: "problems",
        type: "integer",
        description: "Items in it, across sections.",
      },
      flag(
        "lesson",
        'It opens with a lesson ("Today\'s idea"). Empty for older workbooks.',
      ),
      {
        name: "lean",
        type: "text",
        description:
          "What the adult asked it to lean toward. Empty for older workbooks.",
      },
      {
        name: "focus_skill_id",
        type: "id",
        description:
          "The skill a teacher's group sheet focused on. Empty otherwise.",
      },
      {
        name: "working_level",
        type: "number",
        description:
          "The rounded working level it was made at (grade scale as in answers.csv).",
      },
    ],
  },
  {
    name: "adult_checkins.csv",
    description:
      "Each time a parent or teacher checked in on the participant from enrolment on: read their record, assigned work, or scored a workbook. It does not say which adult.",
    row: "One check-in.",
    columns: [
      learner,
      week,
      {
        name: "role",
        type: "text",
        description: "Who checked in.",
        values: ["parent", "teacher", "aide", "school_staff"],
      },
      {
        name: "kind",
        type: "text",
        description: "What they did.",
        values: ["view", "assign", "score"],
      },
    ],
  },
  {
    name: "weekly_activity.csv",
    description:
      "Every instructional week from 1 to the current one, including weeks with no use (all zeros). Answers count from the moment of enrolment. Active time and help are kept per local day, so they count from the first whole day after enrolment: the enrolment day itself is left out, since part of it may come before enrolment.",
    row: "One participant-week.",
    columns: [
      learner,
      week,
      seconds("active"),
      seconds("practice"),
      seconds("feedback"),
      seconds("lesson"),
      seconds("hint"),
      seconds("example"),
      seconds("video"),
      seconds("map"),
      seconds("other"),
      opened("answers", "Answers (as in answers.csv, by the week answered)"),
      opened("correct", "Right answers"),
      opened("independent", "Independent successes (see answers.csv)"),
      opened("lessons_opened", "Lessons opened"),
      opened("hints_opened", "Hints opened"),
      opened("examples_opened", "Worked examples opened"),
      opened("videos_opened", "Videos opened"),
      opened("video_plays", "Videos played"),
      opened("video_completes", "Videos played to the end"),
      opened("prints", "Lesson PDFs printed"),
    ],
  },
  {
    name: "skills.csv",
    description:
      "AMP's skill catalog at the time of the extract: content, not participant data.",
    row: "One skill.",
    columns: [
      {
        name: "skill_id",
        type: "id",
        description: "The skill's id, as in answers.csv.",
      },
      { name: "title", type: "text", description: "Its title." },
      {
        name: "strand",
        type: "text",
        description: "The engine strand it belongs to.",
      },
      { name: "area", type: "text", description: "The NCTM content area." },
      { name: "grade_band", type: "text", description: "Its grade or course." },
      {
        name: "grade",
        type: "integer",
        description:
          "The same on the grade scale used for levels (K = 0 … Precalculus = 12).",
      },
    ],
  },
] as const satisfies readonly FileSpec[];

export type ExtractFileName = (typeof EXTRACT_FILES)[number]["name"];

export const headerOf = (name: ExtractFileName) =>
  EXTRACT_FILES.find((file) => file.name === name)!.columns.map(
    (column) => column.name,
  );

const GENERAL = [
  "Every file is UTF-8 CSV with a header row and CRLF line ends. Empty means no value.",
  "Booleans are true or false.",
  "Participants are keyed by study ID only. No names, email addresses, account or learner ids, network addresses, birth dates or text anyone typed are in any file, and no calendar dates: time is the instructional week relative to each participant's enrolment.",
  "Only participants enrolled and not withdrawn when the extract was made are included, with their records from enrolment on.",
  "manifest.json lists each file's rows, bytes and SHA-256. It carries no date, and every file in the ZIP has the same fixed time.",
];

export function codebookJson(study: string) {
  return {
    format: "amp-research-extract",
    version: EXTRACT_VERSION,
    study,
    notes: GENERAL,
    files: EXTRACT_FILES,
  };
}

export function codebookMarkdown(study: string): string {
  const lines = [
    `# AMP research extract codebook (study ${study}, version ${EXTRACT_VERSION})`,
    "",
    ...GENERAL.map((note) => `- ${note}`),
  ];
  for (const file of EXTRACT_FILES) {
    lines.push(
      "",
      `## ${file.name}`,
      "",
      file.description,
      "",
      `Row: ${file.row}`,
      "",
    );
    lines.push("| Column | Type | Meaning |", "| --- | --- | --- |");
    for (const column of file.columns as readonly Column[]) {
      const values = column.values
        ? ` Values: ${column.values.join(", ")}.`
        : "";
      lines.push(
        `| ${column.name} | ${column.type} | ${column.description.replaceAll("|", "\\|")}${values} |`,
      );
    }
  }
  return lines.join("\n") + "\n";
}
