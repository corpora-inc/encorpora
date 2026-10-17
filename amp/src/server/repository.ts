import {
  lockLearningAccount,
  learningConsentActive,
} from "./account-access.js";
import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "./schema";
import type { SkillProgress } from "./progress";
import type { GeneratedProblem } from "../math/contracts";
export type Learner = { id: string; name: string };
export type Outcome = {
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
export type SavedProblem = GeneratedProblem & { hintViewed?: boolean };
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export interface LearnerTransaction {
  recentAttempts(): Promise<Outcome[]>;
  attemptByRequest(requestId: string): Promise<Outcome | undefined>;
  attemptByProblem(problemId: string): Promise<Outcome | undefined>;
  progress(skillIds: string[]): Promise<SkillProgress[]>;
  problem(id: string): Promise<SavedProblem | undefined>;
  saveProblem(problem: SavedProblem): Promise<void>;
  saveAttempt(outcome: Outcome): Promise<void>;
  hasAccess(): Promise<boolean>;
}
export interface Repository {
  hasConsent(accountId: string): Promise<boolean>;
  list(accountId: string): Promise<Learner[]>;
  create(accountId: string, name: string): Promise<Learner>;
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
    const result = await this.pool.query(
      "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND withdrawn_at IS NULL",
      [accountId],
    );
    return !!result.rowCount;
  }
  async list(accountId: string) {
    return drizzle(this.pool)
      .select({ id: schema.learners.id, name: schema.learners.name })
      .from(schema.learners)
      .where(
        and(
          eq(schema.learners.accountId, accountId),
          isNull(schema.learners.deletedAt),
        ),
      );
  }
  async create(accountId: string, name: string) {
    const learner = { id: randomUUID(), name };
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
        "INSERT INTO amp_learners(id,account_id,name) VALUES($1,$2,$3)",
        [learner.id, accountId, learner.name],
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
class PgTransaction implements LearnerTransaction {
  constructor(
    private db: PoolClient,
    private learnerId: string,
  ) {}
  async recentAttempts() {
    const result = await this.db.query(
      "SELECT outcome FROM amp_attempts WHERE learner_id=$1 ORDER BY created_at DESC,id DESC LIMIT 200",
      [this.learnerId],
    );
    return result.rows.map((r) => r.outcome as Outcome).reverse();
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
  async progress(skillIds: string[]): Promise<SkillProgress[]> {
    const result = await this.db.query(
      `WITH ranked AS (
    SELECT outcome,created_at,row_number() OVER(PARTITION BY outcome->>'skillId' ORDER BY created_at DESC,id DESC) AS rank
    FROM amp_attempts WHERE learner_id=$1
   ) SELECT outcome->>'skillId' AS skill_id,count(*)::int AS attempts,
    count(*) FILTER (WHERE (outcome->>'correct')::boolean AND NOT (outcome->>'assisted')::boolean)::int AS independent,
    count(*) FILTER (WHERE rank<=5 AND (outcome->>'correct')::boolean AND NOT (outcome->>'assisted')::boolean)::int AS recent,
    max(created_at) AS last FROM ranked GROUP BY outcome->>'skillId'`,
      [this.learnerId],
    );
    return skillIds.map((skillId) => {
      const row = result.rows.find((r) => r.skill_id === skillId);
      return {
        skillId,
        attempts: row?.attempts ?? 0,
        independentCorrect: row?.independent ?? 0,
        recentIndependentCorrect: row?.recent ?? 0,
        status: !row
          ? "new"
          : row.attempts >= 5 && row.recent >= 4
            ? "review-ready"
            : "practicing",
        lastPracticedAt: row?.last?.toISOString() ?? null,
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
