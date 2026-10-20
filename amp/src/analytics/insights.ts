import type { Pool } from "pg";
import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import { flagReasons, type FlagReason } from "../feedback/problem-flags";

/**
 * What learners get right, get wrong and leave, how they progress, and what
 * they report. Aggregates only: no learner, account, trial or name leaves
 * this module. Report notes are included only when `notes` is set (the
 * operator's interactive view); they are never in the default output.
 */
export type TemplateInsight = {
  templateId: string;
  title: string;
  skillId: string;
  strand: string;
  served: number;
  answered: number;
  correct: number | null;
  incorrect: number | null;
  /** Explicit skips (a skip marked on the problem); null before skips exist. */
  skipped: number | null;
  /** Served and never answered or skipped (left, or fetched in advance). */
  unanswered: number | null;
  assisted: number | null;
  /** Median seconds from serving to the answer. */
  medianSeconds: number | null;
  flags: number;
  topReasons: { reason: FlagReason; count: number }[];
};
export type SkillInsight = {
  skillId: string;
  title: string;
  strand: string;
  learners: number;
  practicing: number;
  reviewReady: number;
  medianAttemptsToReady: number | null;
};
export type StrandInsight = {
  strand: string;
  learners: number;
  answered: number;
  correct: number | null;
  reviewReadySkills: number;
};
export type TrialInsight = {
  started: number;
  /** Trials that answered at least n problems, for each threshold. */
  reached: { answers: number; trials: number; share: number | null }[];
  placementDone: number;
  paywall: number;
  saved: number;
  placedGradeBands: { gradeBand: string; count: number }[];
};
export type FlagInsight = {
  createdAt: string;
  templateId: string;
  seed: string;
  outcome: string;
  response: string | null;
  reasons: FlagReason[];
  prompt: string;
  figureKind: string | null;
  clientKind: string;
  viewport: string;
  webCommit: string | null;
  apiCommit: string | null;
  note?: string | null;
};
export type InsightsReport = {
  from: string;
  to: string;
  totals: {
    served: number;
    answered: number;
    correct: number | null;
    skipped: number;
    flags: number;
    learners: number;
    trialLearners: number;
  };
  templates: TemplateInsight[];
  skills: SkillInsight[];
  strands: StrandInsight[];
  trial: TrialInsight;
  startingBands: { band: string; count: number }[];
  reasons: { reason: FlagReason; count: number }[];
  newestFlags: FlagInsight[];
};

const ratio = (a: number, b: number) => (b > 0 ? a / b : null);
const TRIAL_THRESHOLDS = [1, 5, 10, 20, 30, 50, 75, 100];

export async function insightsReport(
  pool: Pool,
  window: { from: Date; to: Date },
  options: { notes?: boolean; newest?: number } = {},
): Promise<InsightsReport> {
  const range = [window.from.toISOString(), window.to.toISOString()];
  const q = async <T extends Record<string, unknown>>(
    sql: string,
    args: unknown[] = range,
  ) => (await pool.query<T>(sql, args)).rows;
  // Problems served in the window, each with its answer (if any).
  const served = `SELECT i.id, i.learner_id, i.created_at AS served_at,
      i.content->'public'->>'templateId' AS template_id,
      COALESCE((i.content->>'skipped')::boolean,false) AS skipped,
      a.created_at AS answered_at,
      (a.outcome->>'correct')::boolean AS correct,
      (a.outcome->>'assisted')::boolean AS assisted
    FROM amp_instances i LEFT JOIN amp_attempts a ON a.problem_id=i.id
    WHERE i.created_at>=$1 AND i.created_at<$2`;
  const perTemplate = await q<{
    template_id: string;
    served: number;
    answered: number;
    correct: number;
    assisted: number;
    skipped: number;
    median: number | null;
  }>(
    `SELECT template_id, count(*)::int AS served,
       count(answered_at)::int AS answered,
       count(*) FILTER (WHERE correct)::int AS correct,
       count(*) FILTER (WHERE assisted)::int AS assisted,
       count(*) FILTER (WHERE skipped AND answered_at IS NULL)::int AS skipped,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM answered_at-served_at))
         FILTER (WHERE answered_at IS NOT NULL) AS median
     FROM (${served}) s GROUP BY template_id`,
  );
  const flagRows = await q<{
    template_id: string;
    reason: FlagReason;
    count: number;
  }>(
    `SELECT template_id, unnest(reasons) AS reason, count(*)::int AS count
     FROM amp_problem_flags WHERE created_at>=$1 AND created_at<$2
     GROUP BY 1,2 ORDER BY 3 DESC,2`,
  );
  const flagCounts = await q<{ template_id: string; flags: number }>(
    `SELECT template_id, count(*)::int AS flags FROM amp_problem_flags
     WHERE created_at>=$1 AND created_at<$2 GROUP BY 1`,
  );
  const skipsRecorded = perTemplate.some((row) => row.skipped > 0);
  const templateMeta = new Map(templates.map((t) => [t.id, t]));
  const skillMeta = new Map(skills.map((s) => [s.id, s]));
  const ids = new Set([
    ...perTemplate.map((r) => r.template_id),
    ...flagCounts.map((r) => r.template_id),
  ]);
  const templateRows: TemplateInsight[] = [...ids].map((templateId) => {
    const row = perTemplate.find((r) => r.template_id === templateId);
    const meta = templateMeta.get(templateId);
    const skill = skillMeta.get(meta?.skillId ?? "");
    const servedCount = row?.served ?? 0;
    const answered = row?.answered ?? 0;
    const skipped = row?.skipped ?? 0;
    return {
      templateId,
      title: meta?.title ?? templateId,
      skillId: meta?.skillId ?? "unknown",
      strand: skill?.strand ?? "unknown",
      served: servedCount,
      answered,
      correct: ratio(row?.correct ?? 0, answered),
      incorrect: ratio(answered - (row?.correct ?? 0), answered),
      skipped: skipsRecorded ? ratio(skipped, servedCount) : null,
      unanswered: ratio(servedCount - answered - skipped, servedCount),
      assisted: ratio(row?.assisted ?? 0, answered),
      medianSeconds:
        row?.median == null ? null : Math.round(Number(row.median)),
      flags: flagCounts.find((r) => r.template_id === templateId)?.flags ?? 0,
      topReasons: flagRows
        .filter((r) => r.template_id === templateId)
        .slice(0, 3)
        .map(({ reason, count }) => ({ reason, count })),
    };
  });
  templateRows.sort(
    (a, b) =>
      b.flags - a.flags ||
      (b.incorrect ?? -1) - (a.incorrect ?? -1) ||
      b.served - a.served ||
      a.templateId.localeCompare(b.templateId),
  );

  // Mastery progression from each learner's current skill evidence.
  const evidence = await q<{
    skill_id: string;
    learners: number;
    practicing: number;
    ready: number;
    median_attempts: number | null;
  }>(
    `SELECT e.skill_id, count(*)::int AS learners,
       count(*) FILTER (WHERE e.state->>'status'='practicing')::int AS practicing,
       count(*) FILTER (WHERE e.state->>'status'='review-ready')::int AS ready,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY (e.state->>'attempts')::int)
         FILTER (WHERE e.state->>'status'='review-ready') AS median_attempts
     FROM amp_skill_evidence e JOIN amp_learners l ON l.id=e.learner_id
     WHERE l.deleted_at IS NULL AND (e.state->>'lastPracticedAt')::timestamptz>=$1
       AND (e.state->>'lastPracticedAt')::timestamptz<$2
     GROUP BY 1`,
  );
  const skillRows: SkillInsight[] = evidence
    .map((row) => {
      const skill = skillMeta.get(row.skill_id);
      return {
        skillId: row.skill_id,
        title: skill?.title ?? row.skill_id,
        strand: skill?.strand ?? "unknown",
        learners: row.learners,
        practicing: row.practicing,
        reviewReady: row.ready,
        medianAttemptsToReady:
          row.median_attempts == null ? null : Number(row.median_attempts),
      };
    })
    .sort(
      (a, b) =>
        a.strand.localeCompare(b.strand) || a.skillId.localeCompare(b.skillId),
    );
  const strandAnswers = new Map<
    string,
    { answered: number; correct: number }
  >();
  for (const row of perTemplate) {
    const strand =
      skillMeta.get(templateMeta.get(row.template_id)?.skillId ?? "")?.strand ??
      "unknown";
    const entry = strandAnswers.get(strand) ?? { answered: 0, correct: 0 };
    entry.answered += row.answered;
    entry.correct += row.correct;
    strandAnswers.set(strand, entry);
  }
  const strandLearners = await q<{ strand: string; learners: number }>(
    `SELECT m.strand, count(DISTINCT i.learner_id)::int AS learners
     FROM amp_instances i
     JOIN unnest($3::text[], $4::text[]) AS m(skill_id, strand)
       ON m.skill_id=i.content->'public'->>'skillId'
     WHERE i.created_at>=$1 AND i.created_at<$2 GROUP BY 1`,
    [...range, skills.map((s) => s.id), skills.map((s) => s.strand)],
  );
  const strands = [
    ...new Set([...strandAnswers.keys(), ...skillRows.map((s) => s.strand)]),
  ].sort();
  const strandRows: StrandInsight[] = strands.map((strand) => {
    const answers = strandAnswers.get(strand) ?? { answered: 0, correct: 0 };
    return {
      strand,
      learners:
        strandLearners.find((row) => row.strand === strand)?.learners ?? 0,
      answered: answers.answered,
      correct: ratio(answers.correct, answers.answered),
      reviewReadySkills: skillRows
        .filter((s) => s.strand === strand)
        .reduce((sum, s) => sum + s.reviewReady, 0),
    };
  });

  // The free trial: problems answered per trial started in the window.
  const trialAnswers = (
    await q<{ answered: number; saved: boolean }>(
      `SELECT t.adopted_at IS NOT NULL AS saved,
         (SELECT count(*)::int FROM amp_attempts a WHERE a.learner_id=t.learner_id) AS answered
       FROM amp_trials t WHERE t.created_at>=$1 AND t.created_at<$2`,
    )
  ).map((row) => ({ answered: Number(row.answered), saved: row.saved }));
  const [events] = await q<{ placement: number; paywall: number }>(
    `SELECT count(*) FILTER (WHERE event='placement_done')::int AS placement,
       count(*) FILTER (WHERE event='paywall')::int AS paywall
     FROM amp_trial_events WHERE occurred_at>=$1 AND occurred_at<$2`,
  );
  const placed = await q<{ gradeBand: string; count: number }>(
    `SELECT COALESCE(props->>'gradeBand','unknown') AS "gradeBand", count(*)::int AS count
     FROM amp_funnel_events WHERE event='placement_done'
       AND occurred_on>=$1::date AND occurred_on<$2::date GROUP BY 1 ORDER BY 2 DESC,1`,
  );
  const startingBands = await q<{ band: string; count: number }>(
    `SELECT COALESCE(starting_band,'not chosen') AS band, count(*)::int AS count
     FROM amp_learners WHERE deleted_at IS NULL AND account_id NOT LIKE 'trial:%'
       AND created_at>=$1 AND created_at<$2 GROUP BY 1 ORDER BY 2 DESC,1`,
  );
  const started = trialAnswers.length;
  const trial: TrialInsight = {
    started,
    reached: TRIAL_THRESHOLDS.map((answers) => {
      const trials = trialAnswers.filter((t) => t.answered >= answers).length;
      return { answers, trials, share: ratio(trials, started) };
    }),
    placementDone: events?.placement ?? 0,
    paywall: events?.paywall ?? 0,
    saved: trialAnswers.filter((t) => t.saved).length,
    placedGradeBands: placed,
  };

  const reasons = await q<{ reason: FlagReason; count: number }>(
    `SELECT unnest(reasons) AS reason, count(*)::int AS count FROM amp_problem_flags
     WHERE created_at>=$1 AND created_at<$2 GROUP BY 1`,
  );
  const newest = await q<Record<string, unknown>>(
    `SELECT created_at, template_id, seed, outcome, response, reasons, prompt, figure_kind,
       client_kind, viewport_width, viewport_height, web_commit, api_commit${options.notes ? ", note" : ""}
     FROM amp_problem_flags WHERE created_at>=$1 AND created_at<$2
     ORDER BY created_at DESC, id LIMIT $3`,
    [...range, options.newest ?? 20],
  );
  const [totals] = await q<{
    served: number;
    answered: number;
    correct: number;
    skipped: number;
    learners: number;
    trial_learners: number;
  }>(
    `SELECT count(*)::int AS served, count(answered_at)::int AS answered,
       count(*) FILTER (WHERE correct)::int AS correct,
       count(*) FILTER (WHERE skipped AND answered_at IS NULL)::int AS skipped,
       count(DISTINCT learner_id)::int AS learners,
       count(DISTINCT learner_id) FILTER (WHERE learner_id IN
         (SELECT l.id FROM amp_learners l WHERE l.account_id LIKE 'trial:%'))::int AS trial_learners
     FROM (${served}) s`,
  );
  return {
    from: range[0]!,
    to: range[1]!,
    totals: {
      served: totals?.served ?? 0,
      answered: totals?.answered ?? 0,
      correct: ratio(totals?.correct ?? 0, totals?.answered ?? 0),
      skipped: totals?.skipped ?? 0,
      flags: flagCounts.reduce((sum, row) => sum + row.flags, 0),
      learners: totals?.learners ?? 0,
      trialLearners: totals?.trial_learners ?? 0,
    },
    templates: templateRows,
    skills: skillRows,
    strands: strandRows,
    trial,
    startingBands,
    reasons: flagReasons.map((reason) => ({
      reason,
      count: reasons.find((r) => r.reason === reason)?.count ?? 0,
    })),
    newestFlags: newest.map((row) => ({
      createdAt: new Date(row.created_at as string).toISOString(),
      templateId: row.template_id as string,
      seed: row.seed as string,
      outcome: row.outcome as string,
      response: (row.response as string | null) ?? null,
      reasons: row.reasons as FlagReason[],
      prompt: row.prompt as string,
      figureKind: (row.figure_kind as string | null) ?? null,
      clientKind: row.client_kind as string,
      viewport: `${row.viewport_width}x${row.viewport_height}`,
      webCommit: (row.web_commit as string | null) ?? null,
      apiCommit: (row.api_commit as string | null) ?? null,
      ...(options.notes ? { note: (row.note as string | null) ?? null } : {}),
    })),
  };
}

const percent = (value: number | null) =>
  value === null ? "—" : `${(value * 100).toFixed(0)}%`;
function table(headers: string[], rows: (string | number)[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i]).length)),
  );
  const line = (cells: (string | number)[]) =>
    cells
      .map((c, i) =>
        i === 0 ? String(c).padEnd(widths[i]!) : String(c).padStart(widths[i]!),
      )
      .join("  ");
  return [
    line(headers),
    widths.map((w) => "-".repeat(w)).join("  "),
    ...rows.map(line),
  ].join("\n");
}
const short = (text: string, length: number) =>
  text.replace(/\s+/g, " ").length > length
    ? `${text.replace(/\s+/g, " ").slice(0, length - 1)}…`
    : text.replace(/\s+/g, " ");
const reasonList = (reasons: { reason: string; count: number }[]) =>
  reasons.map((r) => `${r.reason} ${r.count}`).join(", ") || "—";

/** Plain-text tables for a terminal or job log. */
export function formatInsights(report: InsightsReport): string {
  const t = report.totals;
  const out = [
    `AMP insights, ${report.from.slice(0, 10)} up to ${report.to.slice(0, 10)}`,
    `${t.served} problems served to ${t.learners} learners (${t.trialLearners} in free trials); ${t.answered} answered, ${percent(t.correct)} correct; ${t.skipped} skipped; ${t.flags} reported`,
    "",
    "Problem families (most reported, then most missed)",
    table(
      [
        "Template",
        "Served",
        "Answered",
        "Correct",
        "Wrong",
        "Skip",
        "Left",
        "Helped",
        "Median s",
        "Flags",
        "Top reasons",
      ],
      report.templates.map((r) => [
        r.templateId,
        r.served,
        r.answered,
        percent(r.correct),
        percent(r.incorrect),
        percent(r.skipped),
        percent(r.unanswered),
        percent(r.assisted),
        r.medianSeconds ?? "—",
        r.flags,
        reasonList(r.topReasons),
      ]),
    ),
    "",
    "Strands",
    table(
      ["Strand", "Learners", "Answered", "Correct", "Skills ready"],
      report.strands.map((r) => [
        r.strand,
        r.learners,
        r.answered,
        percent(r.correct),
        r.reviewReadySkills,
      ]),
    ),
    "",
    "Skills practiced in the window: learners practicing and review-ready",
    table(
      [
        "Skill",
        "Strand",
        "Learners",
        "Practicing",
        "Ready",
        "Median tries to ready",
      ],
      report.skills.map((r) => [
        r.skillId,
        r.strand,
        r.learners,
        r.practicing,
        r.reviewReady,
        r.medianAttemptsToReady ?? "—",
      ]),
    ),
    "",
    `Free trials started: ${report.trial.started}; placement done ${report.trial.placementDone}; paywall shown ${report.trial.paywall}; saved to a family ${report.trial.saved}`,
    table(
      ["Answered at least", "Trials", "Share"],
      report.trial.reached.map((r) => [r.answers, r.trials, percent(r.share)]),
    ),
    "",
    table(
      ["Placed grade band", "Trials"],
      report.trial.placedGradeBands.map((r) => [r.gradeBand, r.count]),
    ),
    "",
    table(
      ["Family starting point", "Learners"],
      report.startingBands.map((r) => [r.band, r.count]),
    ),
    "",
    table(
      ["Report reason", "Count"],
      report.reasons.map((r) => [r.reason, r.count]),
    ),
    "",
    `Newest reports (${report.newestFlags.length})`,
  ];
  for (const flag of report.newestFlags) {
    out.push(
      `${flag.createdAt.slice(0, 16).replace("T", " ")}  ${flag.templateId} seed ${flag.seed}  ${flag.outcome}${flag.response ? ` (answered ${flag.response})` : ""}  ${flag.reasons.join(", ")}`,
      `    ${short(flag.prompt, 160)}${flag.figureKind ? `  [figure: ${flag.figureKind}]` : ""}`,
      `    ${flag.clientKind} client at ${flag.viewport}; web build ${flag.webCommit?.slice(0, 9) ?? "unknown"}, API build ${flag.apiCommit?.slice(0, 9) ?? "unknown"}`,
    );
    if (flag.note) out.push(`    Note: ${short(flag.note, 280)}`);
  }
  return out.join("\n");
}

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  // A leading formula character is neutralised for spreadsheet safety.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
};
const csv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";

/** One CSV per section, keyed by file name. */
export function insightsCsv(report: InsightsReport): Record<string, string> {
  return {
    "templates.csv": csv(
      [
        "template_id",
        "title",
        "skill_id",
        "strand",
        "served",
        "answered",
        "correct_rate",
        "incorrect_rate",
        "skip_rate",
        "unanswered_rate",
        "assisted_rate",
        "median_seconds",
        "flags",
        "top_reasons",
      ],
      report.templates.map((r) => [
        r.templateId,
        r.title,
        r.skillId,
        r.strand,
        r.served,
        r.answered,
        r.correct,
        r.incorrect,
        r.skipped,
        r.unanswered,
        r.assisted,
        r.medianSeconds,
        r.flags,
        r.topReasons.map((x) => `${x.reason}:${x.count}`).join(" "),
      ]),
    ),
    "skills.csv": csv(
      [
        "skill_id",
        "title",
        "strand",
        "learners",
        "practicing",
        "review_ready",
        "median_attempts_to_ready",
      ],
      report.skills.map((r) => [
        r.skillId,
        r.title,
        r.strand,
        r.learners,
        r.practicing,
        r.reviewReady,
        r.medianAttemptsToReady,
      ]),
    ),
    "strands.csv": csv(
      ["strand", "learners", "answered", "correct_rate", "review_ready_skills"],
      report.strands.map((r) => [
        r.strand,
        r.learners,
        r.answered,
        r.correct,
        r.reviewReadySkills,
      ]),
    ),
    "trial.csv": csv(
      ["answered_at_least", "trials", "share"],
      report.trial.reached.map((r) => [r.answers, r.trials, r.share]),
    ),
    "flags.csv": csv(
      [
        "created_at",
        "template_id",
        "seed",
        "outcome",
        "response",
        "reasons",
        "prompt",
        "figure_kind",
        "client_kind",
        "viewport",
        "web_commit",
        "api_commit",
        ...(report.newestFlags.some((f) => "note" in f) ? ["note"] : []),
      ],
      report.newestFlags.map((f) => [
        f.createdAt,
        f.templateId,
        f.seed,
        f.outcome,
        f.response,
        f.reasons.join(" "),
        f.prompt,
        f.figureKind,
        f.clientKind,
        f.viewport,
        f.webCommit,
        f.apiCommit,
        ...("note" in f ? [f.note] : []),
      ]),
    ),
  };
}
