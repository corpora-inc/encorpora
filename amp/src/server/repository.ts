import { teachingMaterial } from "./trial-material";
import {
  readTrialProgress,
  recordTrialEvent,
  recordTrialMilestones,
  TEACHING_ATTEMPTS,
  type TrialProgress,
} from "./trial-progress";
import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import {
  estimateFrontier,
  initialLevel,
  type Frontier,
} from "../learning/frontier";
import { templateGrade } from "./mixed-practice";
const templateById = new Map(templates.map((t) => [t.id, t]));
const skillById = new Map(skills.map((s) => [s.id, s]));
import {
  lockLearningAccount,
  learningConsentActive,
} from "./account-access.js";
import { randomUUID } from "node:crypto";
import {
  isTrialAccount,
  newTrialToken,
  TRIAL_ATTEMPTS,
  TRIAL_DAYS,
  TRIAL_PREFIX,
  trialTokenHash,
} from "./trials";
import type { Pool, PoolClient } from "pg";
import { createDatabasePool } from "./database.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "./schema";
import type { SkillEvidence } from "./evidence.js";
import type { LearnerSkillProgress } from "./progress";
import type { GeneratedProblem } from "../math/contracts";
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
};
export type SavedProblem = GeneratedProblem & {
  hintViewed?: boolean;
  lessonViewed?: boolean;
  trialTeaching?: boolean;
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
  hasAccess(): Promise<boolean>;
  /** Answers left in an anonymous trial, or null for a parent's learner. */
  trialRemaining(): Promise<number | null>;
  trialProgress(): Promise<TrialProgress | null>;
  beginTrialTeaching(): Promise<void>;
  trialPaywall(): Promise<void>;
  trialPlacementProblems(): Promise<SavedProblem[]>;
  trialMaterial(): Promise<ReturnType<typeof teachingMaterial>>;
}
export interface Repository {
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
    private readonly options: { development?: boolean } = {},
  ) {
    this.pool = createDatabasePool({ connectionString });
  }
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
      const result = await run(new PgTransaction(client, learnerId));
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
        "SELECT id,learner_id FROM amp_trials WHERE token_hash=$1 AND adopted_at IS NULL AND expires_at>now() FOR UPDATE",
        [trialTokenHash(token)],
      );
      if (!trial.rowCount)
        throw new ApiError(404, "This trial has ended or was already saved");
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
  async frontier(now = Date.now()): Promise<Frontier> {
    const learner = await this.db.query(
      "SELECT birth_year,starting_band FROM amp_learners WHERE id=$1",
      [this.learnerId],
    );
    const history = await this.db.query(
      `SELECT outcome->>'templateId' AS "templateId",(outcome->>'correct')::boolean AS correct,
        (outcome->>'assisted')::boolean AS assisted,outcome->>'createdAt' AS "createdAt" FROM amp_attempts
        WHERE learner_id=$1 ORDER BY evidence_sequence`,
      [this.learnerId],
    );
    return estimateFrontier({
      start: initialLevel({
        birthYear: learner.rows[0]?.birth_year,
        band: learner.rows[0]?.starting_band,
        now,
      }),
      observations: history.rows,
      now,
      gradeOf: (id) => {
        const template = templateById.get(id);
        return template && templateGrade(template, skillById);
      },
      strandOf: (id) =>
        skillById.get(templateById.get(id)?.skillId ?? "")?.strand ?? id,
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
    await recordTrialMilestones(this.db, this.learnerId);
  }
  async trialPlacementProblems() {
    const result = await this.db.query(
      "SELECT content FROM amp_instances WHERE learner_id=$1 AND NOT COALESCE((content->>'trialTeaching')::boolean,false)",
      [this.learnerId],
    );
    return result.rows.map((row) => row.content as SavedProblem);
  }
  async trialProgress() {
    return readTrialProgress(this.db, this.learnerId, () => this.frontier());
  }
  async trialMaterial() {
    const stored = await this.db.query(
      "SELECT teaching_material FROM amp_trials WHERE learner_id=$1 AND adopted_at IS NULL",
      [this.learnerId],
    );
    if (stored.rows[0]?.teaching_material)
      return stored.rows[0].teaching_material as NonNullable<
        ReturnType<typeof teachingMaterial>
      >;
    const progress = await this.trialProgress();
    return progress?.templateId && progress.phase !== "placement"
      ? teachingMaterial(
          progress.templateId,
          this.learnerId,
          (await this.trialPlacementProblems()).map((p) => p.public),
        )
      : null;
  }
  async beginTrialTeaching() {
    const progress = await this.trialProgress();
    if (!progress || progress.phase === "placement")
      throw new ApiError(409, "Finish placement first");
    if (progress.phase === "unavailable")
      throw new ApiError(
        409,
        "No fresh teaching sequence is available at this level",
      );
    if (progress.phase !== "lesson") return;
    const material = await this.trialMaterial();
    if (!material) throw new ApiError(409, "This lesson is unavailable");
    await this.db.query(
      "UPDATE amp_trials SET teaching_template_id=$2,teaching_started_at=now(),teaching_material=$3 WHERE learner_id=$1 AND adopted_at IS NULL",
      [this.learnerId, progress.templateId, JSON.stringify(material)],
    );
  }
  async trialPaywall() {
    const progress = await this.trialProgress();
    if (!progress || progress.phase !== "complete")
      throw new ApiError(409, "Finish the teaching sequence first");
    await recordTrialEvent(this.db, this.learnerId, "paywall");
  }
  async trialRemaining() {
    const progress = await this.trialProgress();
    if (!progress) return null;
    if (progress.phase === "placement")
      return TRIAL_ATTEMPTS - progress.placementAnswered;
    if (progress.phase === "teaching")
      return TEACHING_ATTEMPTS - progress.after.answered;
    return 0;
  }
  async hasAccess() {
    const result = await this.db.query(
      "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<=now() AND ends_at>now() LIMIT 1",
      [this.learnerId],
    );
    return !!result.rowCount;
  }
}
