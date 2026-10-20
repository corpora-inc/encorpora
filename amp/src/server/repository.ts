import {
  isLiveTrial,
  masteredSkills,
  recordTrialEvent,
  recordTrialMilestones,
  trialProgress,
  countSkips,
  type TrialProgress,
} from "./trial-progress";
import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import { guessChanceOf } from "../math/guess-chance";
import {
  estimateFrontier,
  initialLevel,
  type Frontier,
  type FrontierObservation,
} from "../learning/frontier";
import { trendCounts, type TrendPoint } from "../learning/level-check";
import { templateGrade } from "./mixed-practice";
const templateById = new Map(templates.map((t) => [t.id, t]));
const skillById = new Map(skills.map((s) => [s.id, s]));
/** The frontier from a starting level and answers, with the catalog's
 * grades, strands and guessing chances. */
function frontierFrom(
  start: number,
  observations: readonly FrontierObservation[],
  now: number,
): Frontier {
  return estimateFrontier({
    start,
    observations,
    now,
    gradeOf: (id) => {
      const template = templateById.get(id);
      return template && templateGrade(template, skillById);
    },
    strandOf: (id) =>
      skillById.get(templateById.get(id)?.skillId ?? "")?.strand ?? id,
    guessOf: guessChanceOf,
  });
}
import {
  lockLearningAccount,
  learningConsentActive,
} from "./account-access.js";
import { randomUUID } from "node:crypto";
import {
  isTrialAccount,
  newTrialToken,
  TRIAL_DAYS,
  TRIAL_PREFIX,
  trialLimits,
  trialTokenHash,
  type TrialLimits,
} from "./trials";
import type { Pool, PoolClient } from "pg";
import { createDatabasePool } from "./database.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "./schema";
import type { SkillEvidence } from "./evidence.js";
import type { LearnerSkillProgress } from "./progress";
import type { GeneratedProblem } from "../math/contracts";
import type { PracticeSkip } from "../learning/skip";
import type { ProblemFlag } from "../feedback/problem-flags";
import type {
  StartingBand,
  PracticeStartingPoint,
} from "../learning/starting-point";
export type Learner = { id: string; name: string; birthYear: number | null };
export type Outcome = {
  ingestionSequence?: string;
  id: string;
  problemId: string;
  requestId: string;
  skillId: string;
  templateId: string;
  correct: boolean;
  assisted: boolean;
  response: string;
  explanation: string[];
  answer: string;
  createdAt: string;
  /** Only on a skip's reveal, which is never stored as an attempt. */
  skipped?: true;
};
export type SavedProblem = GeneratedProblem & {
  hintViewed?: boolean;
  lessonViewed?: boolean;
  /** Passed with Skip: the answer was shown, and it can no longer be
   * answered for credit. Read by the insights report's skip rate. */
  skipped?: boolean;
  skippedAt?: string;
};
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export interface LearnerTransaction {
  startingPoint(): Promise<PracticeStartingPoint>;
  setStartingPoint(band: StartingBand): Promise<void>;
  setBirthYear(birthYear: number): Promise<void>;
  /** Placement estimate replayed from the learner's whole attempt history. */
  frontier(now?: number): Promise<Frontier>;
  recentAttempts(): Promise<Outcome[]>;
  skillEvidence(): Promise<SkillEvidence[]>;
  attemptByRequest(requestId: string): Promise<Outcome | undefined>;
  attemptByProblem(problemId: string): Promise<Outcome | undefined>;
  progress(skillIds: string[]): Promise<LearnerSkillProgress[]>;
  problem(id: string): Promise<SavedProblem | undefined>;
  saveProblem(problem: SavedProblem): Promise<void>;
  saveAttempt(outcome: Outcome): Promise<void>;
  /** Marks a problem skipped (see learning/skip.ts); no attempt is written. */
  saveSkip(problem: SavedProblem): Promise<void>;
  /** This session's skips, oldest first, for the planner's variety. */
  recentSkips(): Promise<PracticeSkip[]>;
  hasAccess(): Promise<boolean>;
  /** Answers left in an anonymous trial, or null for a parent's learner. */
  trialRemaining(): Promise<number | null>;
  /** The free run's phase and totals, or null for a parent's learner. */
  trialProgress(): Promise<TrialProgress | null>;
  /** Skills missed earlier in this learner's history and now review-ready. */
  masteredSkills(): Promise<string[]>;
  /** The frontier as estimated from only the first `answers` answers. */
  frontierAfter(answers: number): Promise<Frontier>;
  /** The overall estimate after 0, every level-check step and all answers:
   * how the level moved over the free run (learning/level-check.ts). */
  frontierTrend(): Promise<TrendPoint[]>;
  trialPaywall(): Promise<void>;
  /** The learner's birth year, or null when none was given. */
  birthYear(): Promise<number | null>;
  /** This learner's saved report for a request, or for a problem. */
  flag(
    key: { requestId: string } | { problemId: string },
  ): Promise<{ id: string; requestId: string } | undefined>;
  saveFlag(flag: ProblemFlag): Promise<void>;
}
export interface Repository {
  /** The anonymous free-trial allowance and its placement length. */
  readonly limits?: TrialLimits;
  hasConsent(accountId: string): Promise<boolean>;
  list(accountId: string): Promise<Learner[]>;
  create(
    accountId: string,
    name: string,
    birthYear?: number | null,
  ): Promise<Learner>;
  transaction<T>(
    accountId: string,
    learnerId: string,
    run: (tx: LearnerTransaction) => Promise<T>,
  ): Promise<T>;
  close(): Promise<void>;
  /** Starts an anonymous placement trial; returns the device's token once. */
  createTrial(
    birthYear: number,
  ): Promise<{ token: string; learnerId: string; expiresAt: string }>;
  /** The synthetic account for a live trial token, or null. */
  trialAccount(token: string): Promise<string | null>;
  /** Moves a trial learner, with all answers, into a parent's account. */
  adoptTrial(accountId: string, token: string, name: string): Promise<Learner>;
}
export class PostgresRepository implements Repository {
  readonly pool: Pool;
  constructor(
    connectionString: string,
    private readonly options: {
      development?: boolean;
      /** Free problems per anonymous trial (`AMP_FREE_PROBLEMS`). */
      freeProblems?: number;
    } = {},
  ) {
    this.pool = createDatabasePool({ connectionString });
    this.limits = trialLimits(options.freeProblems);
  }
  readonly limits: TrialLimits;
  async hasConsent(accountId: string) {
    const client = await this.pool.connect();
    try {
      return await learningConsentActive(client, accountId);
    } finally {
      client.release();
    }
  }

  async list(accountId: string) {
    return drizzle(this.pool)
      .select({
        id: schema.learners.id,
        name: schema.learners.name,
        birthYear: schema.learners.birthYear,
      })
      .from(schema.learners)
      .where(
        and(
          eq(schema.learners.accountId, accountId),
          isNull(schema.learners.deletedAt),
        ),
      );
  }
  async create(accountId: string, name: string, birthYear?: number | null) {
    const learner = { id: randomUUID(), name, birthYear: birthYear ?? null };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockLearningAccount(client, accountId);
      if (
        !(await learningConsentActive(
          client,
          accountId,
          this.options.development,
        ))
      )
        throw new ApiError(
          403,
          "Parent consent is required before collecting learning data",
        );
      await client.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,$3,$4)",
        [learner.id, accountId, learner.name, learner.birthYear],
      );
      await client.query("COMMIT");
      return learner;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async transaction<T>(
    accountId: string,
    learnerId: string,
    run: (tx: LearnerTransaction) => Promise<T>,
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockLearningAccount(client, accountId);
      if (
        !(await learningConsentActive(
          client,
          accountId,
          this.options.development,
        ))
      )
        throw new ApiError(
          403,
          "Parent consent is required before collecting learning data",
        );
      const found = await client.query(
        "SELECT id FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [learnerId, accountId],
      );
      if (!found.rowCount) throw new ApiError(404, "Learner not found");
      if (isTrialAccount(accountId)) {
        const live = await client.query(
          "SELECT 1 FROM amp_trials WHERE learner_id=$1 AND adopted_at IS NULL AND expires_at>now()",
          [learnerId],
        );
        if (!live.rowCount)
          throw new ApiError(401, "This free trial has ended");
      }
      const result = await run(
        new PgTransaction(client, learnerId, this.limits),
      );
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async close() {
    await this.pool.end();
  }
  async createTrial(birthYear: number) {
    const id = randomUUID(),
      learnerId = randomUUID(),
      token = newTrialToken(),
      expiresAt = new Date(Date.now() + TRIAL_DAYS * 86400000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Trial',$3)",
        [learnerId, `${TRIAL_PREFIX}${id}`, birthYear],
      );
      await client.query(
        "INSERT INTO amp_trials(id,token_hash,learner_id,expires_at) VALUES($1,$2,$3,$4)",
        [id, trialTokenHash(token), learnerId, expiresAt],
      );
      await recordTrialEvent(client, learnerId, "trial_started");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return { token, learnerId, expiresAt: expiresAt.toISOString() };
  }
  async trialAccount(token: string) {
    const result = await this.pool.query(
      "SELECT id FROM amp_trials WHERE token_hash=$1 AND adopted_at IS NULL AND expires_at>now()",
      [trialTokenHash(token)],
    );
    return result.rowCount ? `${TRIAL_PREFIX}${result.rows[0].id}` : null;
  }
  async adoptTrial(accountId: string, token: string, name: string) {
    if (isTrialAccount(accountId))
      throw new ApiError(403, "Sign in as a parent to keep this progress");
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockLearningAccount(client, accountId);
      if (
        !(await learningConsentActive(
          client,
          accountId,
          this.options.development,
        ))
      )
        throw new ApiError(
          403,
          "Parent consent is required before collecting learning data",
        );
      const trial = await client.query(
        `SELECT id,learner_id,adopted_by FROM amp_trials WHERE token_hash=$1
         AND ((adopted_at IS NULL AND expires_at>now()) OR adopted_by=$2) FOR UPDATE`,
        [trialTokenHash(token), accountId],
      );
      if (!trial.rowCount) throw new ApiError(404, "trial_ended");
      // A retry after a lost response returns the learner it already saved.
      if (trial.rows[0].adopted_by === accountId) {
        const saved = await client.query(
          "SELECT id,name,birth_year FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL",
          [trial.rows[0].learner_id, accountId],
        );
        if (!saved.rowCount) throw new ApiError(404, "trial_ended");
        await client.query("COMMIT");
        return {
          id: saved.rows[0].id,
          name: saved.rows[0].name,
          birthYear: saved.rows[0].birth_year,
        };
      }
      const { id, learner_id: learnerId } = trial.rows[0];
      const moved = await client.query(
        "UPDATE amp_learners SET account_id=$1,name=$2 WHERE id=$3 AND account_id=$4 AND deleted_at IS NULL RETURNING birth_year",
        [accountId, name, learnerId, `${TRIAL_PREFIX}${id}`],
      );
      if (!moved.rowCount) throw new ApiError(404, "Trial learner not found");
      await client.query(
        "UPDATE amp_trials SET adopted_at=now(),adopted_by=$2 WHERE id=$1",
        [id, accountId],
      );
      await client.query("COMMIT");
      return { id: learnerId, name, birthYear: moved.rows[0].birth_year };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}
export class PgTransaction implements LearnerTransaction {
  constructor(
    private db: PoolClient,
    private learnerId: string,
    private limits: TrialLimits = trialLimits(),
  ) {}
  async startingPoint(): Promise<PracticeStartingPoint> {
    const result = await this.db.query(
      'SELECT starting_band AS band,starting_policy AS "policyVersion",COALESCE(starting_excluded_strands,ARRAY[]::text[]) AS "excludedStrands" FROM amp_learners WHERE id=$1',
      [this.learnerId],
    );
    return result.rows[0];
  }
  async setStartingPoint(band: StartingBand): Promise<void> {
    const observed = await this.db.query(
      "SELECT skill_id FROM amp_skill_evidence WHERE learner_id=$1",
      [this.learnerId],
    );
    const strands = new Map(skills.map((skill) => [skill.id, skill.strand]));
    const excluded = [
      ...new Set(
        observed.rows.map((row) => strands.get(row.skill_id) ?? row.skill_id),
      ),
    ].sort();
    await this.db.query(
      "UPDATE amp_learners SET starting_band=$2,starting_policy=1,starting_excluded_strands=COALESCE(starting_excluded_strands,$3::text[]) WHERE id=$1",
      [this.learnerId, band, excluded],
    );
  }
  async setBirthYear(birthYear: number) {
    await this.db.query("UPDATE amp_learners SET birth_year=$2 WHERE id=$1", [
      this.learnerId,
      birthYear,
    ]);
  }
  async frontier(
    now = Date.now(),
    answers: number | null = null,
  ): Promise<Frontier> {
    const { start, observations } = await this.frontierInputs(now, answers);
    return frontierFrom(start, observations, now);
  }
  /** The starting estimate from age and the answers in evidence order. */
  private async frontierInputs(now: number, answers: number | null = null) {
    const learner = await this.db.query(
      "SELECT birth_year,starting_band FROM amp_learners WHERE id=$1",
      [this.learnerId],
    );
    const history = await this.db.query(
      `SELECT outcome->>'templateId' AS "templateId",(outcome->>'correct')::boolean AS correct,
        (outcome->>'assisted')::boolean AS assisted,outcome->>'createdAt' AS "createdAt" FROM amp_attempts
        WHERE learner_id=$1 ORDER BY evidence_sequence LIMIT $2`,
      [this.learnerId, answers],
    );
    return {
      start: initialLevel({
        birthYear: learner.rows[0]?.birth_year,
        band: learner.rows[0]?.starting_band,
        now,
      }),
      observations: history.rows as FrontierObservation[],
    };
  }
  async frontierTrend(): Promise<TrendPoint[]> {
    const now = Date.now();
    const { start, observations } = await this.frontierInputs(now);
    return trendCounts(observations.length).map((answered) => {
      const { level, sd } = frontierFrom(
        start,
        observations.slice(0, answered),
        now,
      ).overall;
      return { answered, level, sd };
    });
  }
  async recentAttempts() {
    const result = await this.db.query(
      "SELECT outcome,evidence_sequence::text AS sequence FROM amp_attempts WHERE learner_id=$1 ORDER BY evidence_sequence DESC LIMIT 12",
      [this.learnerId],
    );
    return result.rows
      .map((r) => ({ ...r.outcome, ingestionSequence: r.sequence }) as Outcome)
      .reverse();
  }
  async attemptByRequest(requestId: string) {
    const result = await this.db.query(
      "SELECT outcome FROM amp_attempts WHERE learner_id=$1 AND request_id=$2",
      [this.learnerId, requestId],
    );
    return result.rows[0]?.outcome as Outcome | undefined;
  }
  async attemptByProblem(problemId: string) {
    const result = await this.db.query(
      "SELECT outcome FROM amp_attempts WHERE learner_id=$1 AND problem_id=$2",
      [this.learnerId, problemId],
    );
    return result.rows[0]?.outcome as Outcome | undefined;
  }
  async skillEvidence(): Promise<SkillEvidence[]> {
    const result = await this.db.query(
      "SELECT state FROM amp_skill_evidence WHERE learner_id=$1 ORDER BY skill_id",
      [this.learnerId],
    );
    return result.rows.map((row) => row.state as SkillEvidence);
  }
  async progress(skillIds: string[]): Promise<LearnerSkillProgress[]> {
    const bySkill = new Map(
      (await this.skillEvidence()).map((entry) => [entry.skillId, entry]),
    );
    return skillIds.map((skillId) => {
      const state = bySkill.get(skillId);
      return {
        skillId,
        attempts: state?.attempts ?? 0,
        independentCorrect: state?.independentCorrect ?? 0,
        recentIndependentCorrect: state?.recentIndependentCorrect ?? 0,
        status: state?.status ?? "new",
        lastPracticedAt: state?.lastPracticedAt ?? null,
        reviewDueAt:
          state?.reviewDueAt == null
            ? null
            : new Date(state.reviewDueAt).toISOString(),
        independentOccasions: state?.creditedRetrievals ?? 0,
        recent: (state?.recentOutcomes ?? []).map(
          ({ correct, assisted, createdAt }) => ({
            correct,
            assisted,
            at: createdAt,
          }),
        ),
      };
    });
  }
  async problem(id: string) {
    const result = await this.db.query(
      "SELECT content FROM amp_instances WHERE id=$1 AND learner_id=$2",
      [id, this.learnerId],
    );
    return result.rows[0]?.content as SavedProblem | undefined;
  }
  async saveProblem(problem: SavedProblem) {
    await this.db.query(
      "INSERT INTO amp_instances(id,learner_id,content) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content WHERE amp_instances.learner_id=EXCLUDED.learner_id",
      [problem.public.id, this.learnerId, JSON.stringify(problem)],
    );
  }
  async saveAttempt(outcome: Outcome) {
    await this.db.query(
      "INSERT INTO amp_attempts(id,learner_id,problem_id,request_id,outcome) VALUES($1,$2,$3,$4,$5)",
      [
        outcome.id,
        this.learnerId,
        outcome.problemId,
        outcome.requestId,
        JSON.stringify(outcome),
      ],
    );
    await recordTrialMilestones(this.db, this.learnerId, this.limits);
  }
  async trialProgress() {
    if (!(await isLiveTrial(this.db, this.learnerId))) return null;
    const attempts = await this.db.query(
      "SELECT (outcome->>'correct')::boolean AS correct,(outcome->>'assisted')::boolean AS assisted FROM amp_attempts WHERE learner_id=$1",
      [this.learnerId],
    );
    return trialProgress(
      attempts.rows,
      this.limits,
      await countSkips(this.db, this.learnerId),
    );
  }
  async saveSkip(problem: SavedProblem) {
    await this.saveProblem(problem);
    await recordTrialMilestones(this.db, this.learnerId, this.limits);
  }
  async recentSkips(): Promise<PracticeSkip[]> {
    const result = await this.db.query(
      `SELECT content->'public'->>'templateId' AS "templateId",
        content->'public'->>'skillId' AS "skillId", content->>'skippedAt' AS "createdAt"
       FROM amp_instances WHERE learner_id=$1 AND (content->>'skipped')::boolean
         AND created_at>now()-interval '3 hours'
       ORDER BY content->>'skippedAt' DESC LIMIT 12`,
      [this.learnerId],
    );
    return (result.rows as PracticeSkip[]).reverse();
  }
  async masteredSkills() {
    return masteredSkills(await this.skillEvidence());
  }
  async frontierAfter(answers: number) {
    return this.frontier(Date.now(), answers);
  }
  async trialPaywall() {
    if (!(await isLiveTrial(this.db, this.learnerId)))
      throw new ApiError(404, "Trial not found");
    await recordTrialEvent(this.db, this.learnerId, "paywall");
  }
  async birthYear() {
    const result = await this.db.query(
      "SELECT birth_year FROM amp_learners WHERE id=$1",
      [this.learnerId],
    );
    return (result.rows[0]?.birth_year as number | null) ?? null;
  }
  async flag(key: { requestId: string } | { problemId: string }) {
    const byRequest = "requestId" in key;
    const result = await this.db.query(
      `SELECT id,request_id AS "requestId" FROM amp_problem_flags WHERE learner_id=$1 AND ${byRequest ? "request_id=$2::uuid" : "problem_id=$2"}`,
      [this.learnerId, byRequest ? key.requestId : key.problemId],
    );
    return result.rows[0] as { id: string; requestId: string } | undefined;
  }
  async saveFlag(flag: ProblemFlag) {
    await this.db.query(
      `INSERT INTO amp_problem_flags(id,learner_id,request_id,problem_id,template_id,template_version,seed,skill_id,
        prompt,figure_kind,response_kind,response,outcome,assisted,reasons,note,web_commit,api_commit,client_kind,
        viewport_width,viewport_height) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
      [
        flag.id,
        this.learnerId,
        flag.requestId,
        flag.problemId,
        flag.templateId,
        flag.templateVersion,
        flag.seed,
        flag.skillId,
        flag.prompt,
        flag.figureKind,
        flag.responseKind,
        flag.response,
        flag.outcome,
        flag.assisted,
        flag.reasons,
        flag.note,
        flag.webCommit,
        flag.apiCommit,
        flag.clientKind,
        flag.viewport.width,
        flag.viewport.height,
      ],
    );
  }
  async trialRemaining() {
    return (await this.trialProgress())?.remaining ?? null;
  }
  async hasAccess() {
    const result = await this.db.query(
      "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<=now() AND ends_at>now() LIMIT 1",
      [this.learnerId],
    );
    return !!result.rowCount;
  }
}
