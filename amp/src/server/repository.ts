import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import { estimateFrontier, initialLevel, type Frontier } from "../learning/frontier";
import { templateGrade } from "./mixed-practice";
const templateById = new Map(templates.map((t) => [t.id, t]));
const skillById = new Map(skills.map((s) => [s.id, s]));
import {
  lockLearningAccount,
  learningConsentActive,
} from "./account-access.js";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
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
}
export class PostgresRepository implements Repository {
  readonly pool: Pool;
  constructor(
    connectionString: string,
    private readonly options: { development?: boolean } = {},
  ) {
    this.pool = new Pool({ connectionString, max: 10 });
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
        (outcome->>'assisted')::boolean AS assisted FROM amp_attempts
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
  }
  async hasAccess() {
    const result = await this.db.query(
      "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<=now() AND ends_at>now() LIMIT 1",
      [this.learnerId],
    );
    return !!result.rowCount;
  }
}
