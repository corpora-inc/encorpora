import type { PoolConfig } from "pg";
import type { GlossaryCard, GlossaryLexicon } from "../glossary/types";
import {
  defaultPracticeSettings,
  practiceSettingsSchema,
  type PracticeSettings,
  type PracticeChange,
} from "../learning/practice-settings";
import { activateGiftInTransaction } from "../access-grants/repository.js";
import {
  isLiveTrial,
  masteredSkills,
  recordTrialEvent,
  recordTrialMilestones,
  type TrialProgress,
  LIVE_TRIAL,
  trialProgressFromCounts,
} from "./trial-progress";
import { skills } from "../curriculum/catalog";
import { templates } from "../math/engine";
import { historicalTemplates } from "../math/historical-templates";
import {
  estimateFrontier,
  initialLevel,
  overallTrend,
  type Estimate,
  type Frontier,
  type FrontierObservation,
} from "../learning/frontier";
import { DEFAULT_FRONTIER_POLICY } from "../learning/frontier-policy";
import {
  advanceLearnerFrontier,
  applyStrandRestart,
  CHECKPOINT_EVERY,
  decodeLearnerFrontier,
  encodeLearnerFrontier,
  frontierCatalog,
  isCurrentLearnerFrontier,
  newLearnerFrontier,
  OFF_THREAD_ANSWERS,
  readLearnerFrontier,
  type LearnerObservation,
} from "./learner-frontier";
import { workbookWorker } from "../workbook/off-thread";
import {
  trendCounts,
  trendStep,
  type TrendPoint,
} from "../learning/level-check";
const templateById = new Map(
  [...templates, ...historicalTemplates].map((t) => [t.id, t]),
);
const skillById = new Map(skills.map((s) => [s.id, s]));
/** The frontier from a starting level and answers, replayed in full. */
function frontierFrom(
  start: number,
  observations: readonly FrontierObservation[],
  now: number,
): Frontier {
  return estimateFrontier({ start, observations, now, ...frontierCatalog });
}
import {
  lockLearningAccount,
  learningConsentActive,
  namingConsentActive,
} from "./account-access.js";
import { insertFamilyChild } from "./learner-label.js";
import { goesByNumber, PARENT_ENTRY } from "../learning/nickname.js";
import {
  familyHasLearnerRoom,
  freeAllowance,
  TOO_MANY_LEARNERS,
  type FreeAllowance,
} from "../learning/free-allowance.js";
import { refreshAdultAccess } from "../account/adult-access.js";
import { profilesCovered } from "../account/practice-profiles.js";
import { secondParentOwner } from "../family/second-parent.js";
import {
  resolveStudentSession,
  type StudentSession,
} from "../schools/principal.js";
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
import { ensureFamilyClass } from "../family/family-class.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq, and, isNull } from "drizzle-orm";
import * as schema from "./schema";
import type { SkillEvidence } from "./evidence.js";
import type { LearnerSkillProgress } from "./progress";
import type { GeneratedProblem, ProblemVariant } from "../math/contracts";
import type { PracticeSkip } from "../learning/skip";
import type { ProblemFlag } from "../feedback/problem-flags";
import type { WorkbookRecord } from "../workbook/contracts";
import type {
  StartingBand,
  PracticeStartingPoint,
} from "../learning/starting-point";
export type Learner = {
  id: string;
  name: string;
  birthYear: number | null;
  namePending?: boolean;
  /** Goes by their number ("Child 2"): no nickname chosen yet. */
  defaultName?: boolean;
};
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
  /** Multi-part choice: whether each blank, in blank order, was right.
   * Structured work: whether each row (an ordering: each position) was
   * right. Credit (`correct`) still needs every part. */
  parts?: boolean[];
  /** Only on a skip's reveal, which is never stored as an attempt. */
  skipped?: true;
  /** The instance's realized variant and axis values, for per-axis evidence. */
  variant?: ProblemVariant;
  /** Where the answer came from; absent for in-app answers. */
  evidenceSource?: "paper";
  /** Below 1 for evidence weaker than a graded answer (a parent's mark
   * without the answer). Absent means 1. */
  evidenceWeight?: number;
  /** Term cards for the explanation's words. Added to the response only,
   * never stored with the attempt. */
  glossary?: GlossaryCard[];
  glossaryLexicon?: GlossaryLexicon;
};
export type SavedProblem = GeneratedProblem & {
  /** Serving context is private and immutable for evidence interpretation. */
  practiceEpoch?: number;
  practiceRevision?: number;
  workingTogether?: boolean;
  selection?: unknown;
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
  practiceSettings(): Promise<PracticeSettings>;
  practiceChange(
    requestId: string,
  ): Promise<{ change: PracticeChange; result: PracticeSettings } | undefined>;
  savePracticeChange(
    change: PracticeChange,
    result: PracticeSettings,
  ): Promise<void>;
  startingPoint(): Promise<PracticeStartingPoint>;
  setStartingPoint(band: StartingBand): Promise<void>;
  setBirthYear(birthYear: number): Promise<void>;
  satMathFocus(): Promise<boolean>;
  setSatMathFocus(enabled: boolean): Promise<void>;
  /** Placement estimate replayed from the learner's whole attempt history. */
  frontier(now?: number): Promise<Frontier>;
  /** A school student's or an adult's level for today, in their timezone. A
   * no-op for any other learner. */
  saveLevelDay(frontier: Frontier): Promise<void>;
  /** Whether this learner is a school student (has an amp_people row). */
  onSchoolRoster(): Promise<boolean>;
  /** Whether this is an adult's own learner (docs/families.md), or one of
   * their practice profiles. */
  isAdult(): Promise<boolean>;
  /** Whether this is a practice profile: an adult practicing as someone else. */
  isSimulation(): Promise<boolean>;
  namePending(): Promise<boolean>;
  recentAttempts(): Promise<Outcome[]>;
  skillEvidence(): Promise<SkillEvidence[]>;
  attemptByRequest(requestId: string): Promise<Outcome | undefined>;
  attemptByProblem(problemId: string): Promise<Outcome | undefined>;
  progress(skillIds: string[]): Promise<LearnerSkillProgress[]>;
  problem(id: string): Promise<SavedProblem | undefined>;
  saveProblem(problem: SavedProblem): Promise<void>;
  saveProblems(problems: readonly SavedProblem[]): Promise<void>;
  saveAttempt(outcome: Outcome): Promise<void>;
  /** Marks a problem skipped (see learning/skip.ts); no attempt is written. */
  saveSkip(problem: SavedProblem): Promise<void>;
  /** This session's skips, oldest first, for the planner's variety. */
  recentSkips(): Promise<PracticeSkip[]>;
  hasAccess(): Promise<boolean>;
  freeAllowance(): Promise<FreeAllowance>;
  /** Answers left in an anonymous trial, or null for a parent's learner. */
  trialRemaining(): Promise<number | null>;
  /** The free run's phase and totals, or null for a parent's learner. */
  trialProgress(): Promise<TrialProgress | null>;
  /** Skills missed earlier in this learner's history and now review-ready. */
  masteredSkills(): Promise<string[]>;
  /** The frontier as estimated from only the first `answers` answers. */
  frontierAfter(answers: number): Promise<Frontier>;
  /** The overall estimate after 0, every level-check step and all answers:
   * how the level moved (learning/level-check.ts). With `points`, the step
   * widens so a long record gives at most about that many. */
  frontierTrend(points?: number): Promise<TrendPoint[]>;
  trialPaywall(): Promise<void>;
  /** The learner's birth year, or null when none was given. */
  birthYear(): Promise<number | null>;
  /** This learner's saved report for a request, or for a problem. */
  flag(
    key: { requestId: string } | { problemId: string },
  ): Promise<{ id: string; requestId: string } | undefined>;
  saveFlag(flag: ProblemFlag): Promise<void>;
  /** This learner's workbooks, newest first (one date, or all; at most
   * `limit` when given). */
  workbooks(date?: string, limit?: number): Promise<WorkbookRecord[]>;
  workbook(id: string): Promise<WorkbookRecord | undefined>;
  /** Stores a workbook unless one exists for its date, number and length;
   * returns the stored one either way. */
  saveWorkbook(workbook: WorkbookRecord): Promise<WorkbookRecord>;
  setWorkbookPaper(id: string, paper: WorkbookRecord["paper"]): Promise<void>;
  /** The workbook printed with this code (newest when codes repeat). */
  workbookByCode(code: string): Promise<WorkbookRecord | undefined>;
  /** Workbooks made in the last day, whose problems mixed practice holds back. */
  recentWorkbooks(): Promise<WorkbookRecord[]>;
}
export interface Repository {
  /** The anonymous free-trial allowance and its placement length. */
  readonly limits?: TrialLimits;
  /** Whether learning is allowed: for the account, or for one of its
   * learners, where the account's adult learner needs no parental consent. */
  hasConsent(accountId: string, learnerId?: string): Promise<boolean>;
  list(accountId: string): Promise<Learner[]>;
  create(
    accountId: string,
    name: string | undefined,
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
    owner?: string,
  ): Promise<{ token: string; learnerId: string; expiresAt: string }>;
  currentTrial?(
    owner: string,
    legacyToken?: string,
  ): Promise<{
    token: string;
    learnerId: string;
    birthYear: number;
    expiresAt: string;
  } | null>;
  /** The synthetic account for a live trial token, or null. */
  trialAccount(token: string, owner?: string): Promise<string | null>;
  /** A live student token's learner and the account it acts as, or null. */
  studentAccount?(token: string): Promise<StudentSession | null>;
  /** The account holder who owns this child, when `accountId` is that
   * family's second parent (docs/families.md); otherwise null. */
  secondParentOwner?(
    accountId: string,
    learnerId: string,
  ): Promise<string | null>;
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
      /** Pool settings for the long-running server (`serverPoolOptions`). */
      pool?: Omit<PoolConfig, "max" | "connectionString">;
    } = {},
  ) {
    this.pool = createDatabasePool({ connectionString, ...options.pool });
    this.limits = trialLimits(options.freeProblems);
  }
  readonly limits: TrialLimits;
  async hasConsent(accountId: string, learnerId?: string) {
    const client = await this.pool.connect();
    try {
      return await learningConsentActive(client, accountId, false, learnerId);
    } finally {
      client.release();
    }
  }

  async list(accountId: string) {
    const rows = await drizzle(this.pool)
      .select({
        id: schema.learners.id,
        name: schema.learners.name,
        namePending: schema.learners.namePending,
        identityScope: schema.learners.identityScope,
        labelNumber: schema.learners.labelNumber,
        birthYear: schema.learners.birthYear,
        satMathFocus: schema.learners.satMathFocus,
      })
      .from(schema.learners)
      .where(
        and(
          eq(schema.learners.accountId, accountId),
          isNull(schema.learners.deletedAt),
          // Practice profiles are the adult's own practice, never the
          // family's learners.
          eq(schema.learners.simulation, false),
        ),
      );
    return rows.map(({ identityScope, labelNumber, ...learner }) => ({
      ...learner,
      ...(goesByNumber({
        name: learner.name,
        identity_scope: identityScope,
        label_number: labelNumber,
      })
        ? { defaultName: true }
        : {}),
    }));
  }
  async create(
    accountId: string,
    name: string | undefined,
    birthYear?: number | null,
  ) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await lockLearningAccount(client, accountId);
      // A parent names their own child with or without verified consent
      // (docs/parent-consent.md#childrens-names). Without it the child learns
      // on the restricted basis, so a birth year is needed; blank is "Child 2".
      const canName = await namingConsentActive(
        client,
        accountId,
        this.options.development,
      );
      const restricted = !canName || name === undefined;
      if (restricted && birthYear == null)
        throw new ApiError(400, "A birth year is required");
      if (
        !canName &&
        (
          await client.query(
            "SELECT 1 FROM amp_parent_consents WHERE account_id=$1 AND withdrawn_at IS NOT NULL",
            [accountId],
          )
        ).rowCount
      )
        throw new ApiError(403, "Learning consent has been withdrawn");
      if (!(await familyHasLearnerRoom(client, accountId)))
        throw new ApiError(403, TOO_MANY_LEARNERS);
      let learner: {
        id: string;
        name: string;
        birthYear: number | null;
        namePending: boolean;
      };
      if (restricted)
        learner = await insertFamilyChild(
          client,
          accountId,
          birthYear!,
          name,
        );
      else {
        learner = {
          id: randomUUID(),
          name,
          birthYear: birthYear ?? null,
          namePending: false,
        };
        await client.query(
          `INSERT INTO amp_learners(id,account_id,name,birth_year,name_basis,name_basis_version,name_basis_at)
           VALUES($1,$2,$3,$4,$5,$6,now())`,
          [
            learner.id,
            accountId,
            learner.name,
            learner.birthYear,
            PARENT_ENTRY.method,
            PARENT_ENTRY.version,
          ],
        );
      }
      // A child is a student of their family's class from the start.
      await ensureFamilyClass(client, this.pool, accountId, {
        converting: false,
      });
      if (canName)
        await activateGiftInTransaction(
          client,
          accountId,
          learner.id,
          this.options,
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
          learnerId,
        ))
      )
        throw new ApiError(
          403,
          "Parent consent is required before collecting learning data",
        );
      const found = await client.query(
        "SELECT * FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE",
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
        new PgTransaction(client, learnerId, this.limits, found.rows[0]),
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
  async createTrial(birthYear: number, owner?: string) {
    const id = randomUUID(),
      learnerId = randomUUID(),
      token = newTrialToken(),
      expiresAt = new Date(Date.now() + TRIAL_DAYS * 86400000);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      if (owner) {
        await client.query(
          "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
          [owner],
        );
        const existing = await client.query(
          `SELECT t.id,t.learner_id,t.expires_at,l.birth_year FROM amp_trials t
           JOIN amp_learners l ON l.id=t.learner_id
           WHERE owner_account_id=$1 AND adopted_at IS NULL AND expires_at>now()`,
          [owner],
        );
        if (existing.rowCount) {
          await client.query("COMMIT");
          const row = existing.rows[0];
          return {
            token: row.id,
            learnerId: row.learner_id,
            birthYear: row.birth_year,
            expiresAt: row.expires_at.toISOString(),
          };
        }
      }
      await client.query(
        "INSERT INTO amp_learners(id,account_id,name,birth_year) VALUES($1,$2,'Trial',$3)",
        [learnerId, `${TRIAL_PREFIX}${id}`, birthYear],
      );
      await client.query(
        "INSERT INTO amp_trials(id,token_hash,learner_id,expires_at,owner_account_id) VALUES($1,$2,$3,$4,$5)",
        [id, trialTokenHash(token), learnerId, expiresAt, owner ?? null],
      );
      await recordTrialEvent(client, learnerId, "trial_started");
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return {
      token: owner ? id : token,
      learnerId,
      birthYear,
      expiresAt: expiresAt.toISOString(),
    };
  }
  async currentTrial(owner: string, legacyToken?: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT pg_advisory_xact_lock(hashtextextended($1,0))",
        [owner],
      );
      let result = await client.query(
        `SELECT t.id,t.learner_id,t.expires_at,l.birth_year FROM amp_trials t
         JOIN amp_learners l ON l.id=t.learner_id
         WHERE owner_account_id=$1 AND adopted_at IS NULL AND expires_at>now()`,
        [owner],
      );
      if (!result.rowCount && legacyToken) {
        result = await client.query(
          `UPDATE amp_trials SET owner_account_id=$1 WHERE token_hash=$2
           AND owner_account_id IS NULL AND adopted_at IS NULL AND expires_at>now()
           RETURNING id,learner_id,expires_at,
           (SELECT birth_year FROM amp_learners WHERE id=learner_id) AS birth_year`,
          [owner, trialTokenHash(legacyToken)],
        );
      }
      await client.query("COMMIT");
      const row = result.rows[0];
      return row
        ? {
            token: row.id,
            learnerId: row.learner_id,
            birthYear: row.birth_year,
            expiresAt: row.expires_at.toISOString(),
          }
        : null;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  studentAccount(token: string) {
    return resolveStudentSession(this.pool, token);
  }
  secondParentOwner(accountId: string, learnerId: string) {
    return secondParentOwner(this.pool, accountId, learnerId);
  }
  async trialAccount(token: string, owner?: string) {
    const result = await this.pool.query(
      `SELECT id FROM amp_trials WHERE
       ((token_hash=$1 AND (owner_account_id IS NULL OR owner_account_id=$3))
        OR (id::text=$2 AND owner_account_id=$3))
       AND adopted_at IS NULL AND expires_at>now()`,
      [trialTokenHash(token), token, owner ?? null],
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
        `SELECT id,learner_id,adopted_by FROM amp_trials WHERE ((token_hash=$1 AND (owner_account_id IS NULL OR owner_account_id=$2)) OR (id::text=$3 AND owner_account_id=$2))
         AND ((adopted_at IS NULL AND expires_at>now()) OR adopted_by=$2) FOR UPDATE`,
        [trialTokenHash(token), accountId, token],
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
      await ensureFamilyClass(client, this.pool, accountId, {
        converting: false,
      });
      await activateGiftInTransaction(
        client,
        accountId,
        learnerId,
        this.options,
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
const observationColumns = `a.outcome->>'templateId' AS "templateId",(outcome->>'correct')::boolean AS correct,
        (outcome->>'assisted')::boolean AS assisted,outcome->>'createdAt' AS "createdAt",(outcome->>'evidenceWeight')::float8 AS "evidenceWeight", COALESCE((i.content->>'practiceRevision')::int,0) AS "practiceRevision"`;
const workbookColumns = `id,to_char(workbook_date,'YYYY-MM-DD') AS date,number,minutes,paper,spec,code,created_at AS "createdAt"`;
function workbookRow(row: Record<string, unknown>): WorkbookRecord {
  return {
    id: row.id as string,
    date: row.date as string,
    number: row.number as number,
    minutes: row.minutes as WorkbookRecord["minutes"],
    paper: row.paper as WorkbookRecord["paper"],
    spec: row.spec as WorkbookRecord["spec"],
    code: row.code as string,
    createdAt: (row.createdAt as Date).toISOString(),
  };
}
export class PgTransaction implements LearnerTransaction {
  private settingsCache?: Promise<PracticeSettings>;
  practiceSettings(): Promise<PracticeSettings> {
    return (this.settingsCache ??= this.db
      .query("SELECT state FROM amp_practice_settings WHERE learner_id=$1", [
        this.learnerId,
      ])
      .then(({ rows }) =>
        rows[0]
          ? practiceSettingsSchema.parse(rows[0].state)
          : defaultPracticeSettings(),
      ));
  }
  async practiceChange(requestId: string) {
    const { rows } = await this.db.query(
      "SELECT change,result FROM amp_practice_changes WHERE learner_id=$1 AND request_id=$2",
      [this.learnerId, requestId],
    );
    return rows[0] as
      { change: PracticeChange; result: PracticeSettings } | undefined;
  }
  async savePracticeChange(change: PracticeChange, result: PracticeSettings) {
    await this.db.query(
      "INSERT INTO amp_practice_changes(learner_id,request_id,change,result) VALUES($1,$2,$3,$4)",
      [
        this.learnerId,
        change.requestId,
        JSON.stringify(change),
        JSON.stringify(result),
      ],
    );
    await this.db.query(
      "INSERT INTO amp_practice_settings(learner_id,state) VALUES($1,$2) ON CONFLICT(learner_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()",
      [this.learnerId, JSON.stringify(result)],
    );
    this.settingsCache = Promise.resolve(result);
  }
  constructor(
    private db: PoolClient,
    private learnerId: string,
    private limits: TrialLimits = trialLimits(),
    /** The locked learner row, so reading it again costs no round trip. */
    private learnerRow?: Record<string, unknown>,
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
    this.learnerRow = undefined;
    await this.db.query(
      "UPDATE amp_learners SET starting_band=$2,starting_policy=1,starting_excluded_strands=COALESCE(starting_excluded_strands,$3::text[]) WHERE id=$1",
      [this.learnerId, band, excluded],
    );
  }
  private async learner() {
    if (!this.learnerRow) {
      const result = await this.db.query(
        "SELECT * FROM amp_learners WHERE id=$1",
        [this.learnerId],
      );
      this.learnerRow = result.rows[0] as Record<string, unknown> | undefined;
    }
    return this.learnerRow;
  }
  async satMathFocus() {
    return (await this.learner())!.sat_math_focus as boolean;
  }
  async setSatMathFocus(enabled: boolean) {
    this.learnerRow = undefined;
    await this.db.query(
      "UPDATE amp_learners SET sat_math_focus=$2 WHERE id=$1",
      [this.learnerId, enabled],
    );
  }
  async setBirthYear(birthYear: number) {
    this.learnerRow = undefined;
    await this.db.query("UPDATE amp_learners SET birth_year=$2 WHERE id=$1", [
      this.learnerId,
      birthYear,
    ]);
  }
  async frontier(
    now = Date.now(),
    answers: number | null = null,
  ): Promise<Frontier> {
    return answers === null
      ? this.currentFrontier(now)
      : this.frontierAtAnswer(now, answers);
  }
  async onSchoolRoster() {
    return (
      (
        await this.db.query("SELECT 1 FROM amp_people WHERE learner_id=$1", [
          this.learnerId,
        ])
      ).rowCount === 1
    );
  }
  async isAdult() {
    return (await this.learner())?.adult === true;
  }
  async isSimulation() {
    return (await this.learner())?.simulation === true;
  }
  async namePending() {
    return (await this.learner())?.name_pending === true;
  }
  async saveLevelDay(frontier: Frontier) {
    const estimate = ({ level, sd, answered, independent }: Estimate) => ({
      level,
      sd,
      answered,
      independent,
    });
    // A school student's day is the school's; an adult's is their own.
    await this.db.query(
      `INSERT INTO amp_level_days(learner_id,day,frontier,policy_version)
       SELECT $1,(now() AT TIME ZONE z.zone)::date,$2::jsonb,$3 FROM (
         SELECT p.timezone AS zone FROM amp_people p WHERE p.learner_id=$1
         UNION ALL
         SELECT COALESCE(l.timezone,'America/New_York') FROM amp_learners l
         WHERE l.id=$1 AND l.adult AND NOT EXISTS(SELECT 1 FROM amp_people p WHERE p.learner_id=$1)
       ) z
       ON CONFLICT(learner_id,day) DO UPDATE SET frontier=EXCLUDED.frontier,policy_version=EXCLUDED.policy_version`,
      [
        this.learnerId,
        JSON.stringify({
          overall: estimate(frontier.overall),
          strands: Object.fromEntries(
            Object.entries(frontier.strands).map(([id, e]) => [
              id,
              estimate(e),
            ]),
          ),
        }),
        DEFAULT_FRONTIER_POLICY.version,
      ],
    );
  }
  /** The level now, from the stored state plus any answers since it was saved. */
  private async currentFrontier(now: number): Promise<Frontier> {
    const settings = await this.practiceSettings();
    const key = {
      epoch: settings.epoch,
      start: await this.startingLevel(now),
      strandStarts: settings.strandStarts,
    };
    const row = await this.db.query(
      "SELECT state FROM amp_frontier_states WHERE learner_id=$1",
      [this.learnerId],
    );
    const decoded = row.rows[0]
      ? decodeLearnerFrontier(row.rows[0].state as string)
      : null;
    const stored =
      decoded && isCurrentLearnerFrontier(decoded, key) ? decoded : null;
    const history = await this.db.query(
      `SELECT ${observationColumns},a.evidence_sequence::text AS sequence FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
        WHERE a.learner_id=$1 AND COALESCE((i.content->>'practiceEpoch')::int,0)=$2 AND a.evidence_sequence>$3::bigint ORDER BY a.evidence_sequence`,
      [this.learnerId, settings.epoch, stored?.sequence ?? "0"],
    );
    const observations = history.rows as LearnerObservation[];
    let state;
    if (observations.length > OFF_THREAD_ANSWERS) {
      const updated = await workbookWorker().frontierState({
        stored: stored ? encodeLearnerFrontier(stored) : null,
        observations,
        key,
      });
      state = decodeLearnerFrontier(updated)!;
    } else {
      state = advanceLearnerFrontier(
        stored ?? newLearnerFrontier(key),
        observations,
      );
    }
    if (observations.length >= CHECKPOINT_EVERY)
      await this.db.query(
        "INSERT INTO amp_frontier_states(learner_id,state) VALUES($1,$2) ON CONFLICT(learner_id) DO UPDATE SET state=EXCLUDED.state,updated_at=now()",
        [this.learnerId, encodeLearnerFrontier(state)],
      );
    return readLearnerFrontier(state, now);
  }
  /** The level as it was after a learner's first `answers` answers. */
  private async frontierAtAnswer(now: number, answers: number) {
    const { start, observations, settings } = await this.frontierInputs(
      now,
      answers,
    );
    const frontier = frontierFrom(start, observations, now);
    for (const [strand, reset] of Object.entries(settings.strandStarts))
      applyStrandRestart(
        frontier,
        strand,
        reset.level,
        frontierFrom(
          reset.level,
          observations.filter(
            (o) =>
              o.practiceRevision >= reset.revision &&
              skillById.get(templateById.get(o.templateId)?.skillId ?? "")
                ?.strand === strand,
          ),
          now,
        ),
      );
    return frontier;
  }
  private async startingLevel(now: number) {
    const learner = await this.learner();
    return initialLevel({
      birthYear: learner?.birth_year as number | null | undefined,
      band: learner?.starting_band as Parameters<
        typeof initialLevel
      >[0]["band"],
      now,
    });
  }
  /** The starting estimate from age and the answers in evidence order. */
  private async frontierInputs(now: number, answers: number | null = null) {
    const settings = await this.practiceSettings();
    const history = await this.db.query(
      `SELECT ${observationColumns} FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id
        WHERE a.learner_id=$1 AND COALESCE((i.content->>'practiceEpoch')::int,0)=$3 ORDER BY a.evidence_sequence LIMIT $2`,
      [this.learnerId, answers, settings.epoch],
    );
    return {
      settings,
      start: await this.startingLevel(now),
      observations: history.rows as (FrontierObservation & {
        practiceRevision: number;
      })[],
    };
  }
  async frontierTrend(points?: number): Promise<TrendPoint[]> {
    const now = Date.now();
    const { start, observations } = await this.frontierInputs(now);
    return overallTrend(
      { start, observations, now, ...frontierCatalog },
      trendCounts(
        observations.length,
        trendStep(observations.length, points),
      ),
    );
  }
  async recentAttempts() {
    const settings = await this.practiceSettings();
    const result = await this.db.query(
      "SELECT a.outcome,a.evidence_sequence::text AS sequence FROM amp_attempts a JOIN amp_instances i ON i.id=a.problem_id WHERE a.learner_id=$1 AND COALESCE((i.content->>'practiceEpoch')::int,0)=$2 ORDER BY a.evidence_sequence DESC LIMIT 12",
      [this.learnerId, settings.epoch],
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
  /** Saves a batch in one round trip. */
  async saveProblems(problems: readonly SavedProblem[]) {
    await this.db.query(
      "INSERT INTO amp_instances(id,learner_id,content) SELECT id,$2,content::jsonb FROM unnest($1::text[],$3::text[]) AS p(id,content) ON CONFLICT(id) DO UPDATE SET content=EXCLUDED.content WHERE amp_instances.learner_id=EXCLUDED.learner_id",
      [
        problems.map((problem) => problem.public.id),
        this.learnerId,
        problems.map((problem) => JSON.stringify(problem)),
      ],
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
    if (outcome.evidenceSource !== "paper") await this.chargeFreeOnline();
    await recordTrialMilestones(this.db, this.learnerId, this.limits);
  }
  async trialProgress() {
    const result = await this.db.query(
      `SELECT answers.*,skips.skipped FROM amp_trials t JOIN amp_learners l ON l.id=t.learner_id,
        LATERAL (SELECT count(*)::int AS answered,count(*) FILTER (WHERE (outcome->>'correct')::boolean)::int AS correct,
          count(*) FILTER (WHERE (outcome->>'assisted')::boolean)::int AS assisted FROM amp_attempts WHERE learner_id=t.learner_id) answers,
        LATERAL (SELECT count(*)::int AS skipped FROM amp_instances WHERE learner_id=t.learner_id AND (content->>'skipped')::boolean) skips
       WHERE t.learner_id=$1 AND ${LIVE_TRIAL}`,
      [this.learnerId],
    );
    const counts = result.rows[0];
    return counts
      ? trialProgressFromCounts(counts, this.limits, counts.skipped)
      : null;
  }
  async saveSkip(problem: SavedProblem) {
    const previous = await this.problem(problem.public.id);
    await this.saveProblem(problem);
    if (!previous?.skipped) await this.chargeFreeOnline();
    await recordTrialMilestones(this.db, this.learnerId, this.limits);
  }
  async recentSkips(): Promise<PracticeSkip[]> {
    const settings = await this.practiceSettings();
    const result = await this.db.query(
      `SELECT content->'public'->>'templateId' AS "templateId",
        content->'public'->>'skillId' AS "skillId", content->>'skippedAt' AS "createdAt"
       FROM amp_instances WHERE learner_id=$1 AND (content->>'skipped')::boolean
         AND created_at>now()-interval '3 hours'
         AND COALESCE((content->>'practiceEpoch')::int,0)=$2
       ORDER BY content->>'skippedAt' DESC LIMIT 12`,
      [this.learnerId, settings.epoch],
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
    return ((await this.learner())?.birth_year as number | null) ?? null;
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
  async workbooks(date?: string, limit?: number) {
    const result = await this.db.query(
      `SELECT ${workbookColumns} FROM amp_workbooks WHERE learner_id=$1
        AND ($2::date IS NULL OR workbook_date=$2::date)
        ORDER BY workbook_date DESC,number DESC,minutes
        LIMIT COALESCE($3::integer, CASE WHEN $2::date IS NULL THEN 400 END)`,
      [this.learnerId, date ?? null, limit ?? null],
    );
    return result.rows.map(workbookRow);
  }
  async workbook(id: string) {
    const result = await this.db.query(
      `SELECT ${workbookColumns} FROM amp_workbooks WHERE learner_id=$1 AND id=$2`,
      [this.learnerId, id],
    );
    return result.rows[0] ? workbookRow(result.rows[0]) : undefined;
  }
  async saveWorkbook(workbook: WorkbookRecord) {
    const inserted = await this.db.query(
      `INSERT INTO amp_workbooks(id,learner_id,workbook_date,number,minutes,paper,spec,code)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT(learner_id,workbook_date,number,minutes) DO NOTHING`,
      [
        workbook.id,
        this.learnerId,
        workbook.date,
        workbook.number,
        workbook.minutes,
        workbook.paper,
        JSON.stringify(workbook.spec),
        workbook.code,
      ],
    );
    if (inserted.rowCount && !(await this.hasAccess()))
      await this.db.query(
        "UPDATE amp_learners SET free_workbooks_used=LEAST(5,free_workbooks_used+1) WHERE id=$1",
        [this.learnerId],
      );
    const result = await this.db.query(
      `SELECT ${workbookColumns} FROM amp_workbooks WHERE learner_id=$1
        AND workbook_date=$2 AND number=$3 AND minutes=$4`,
      [this.learnerId, workbook.date, workbook.number, workbook.minutes],
    );
    return workbookRow(result.rows[0]);
  }
  async setWorkbookPaper(id: string, paper: WorkbookRecord["paper"]) {
    await this.db.query(
      "UPDATE amp_workbooks SET paper=$3 WHERE learner_id=$1 AND id=$2",
      [this.learnerId, id, paper],
    );
  }
  async workbookByCode(code: string) {
    const result = await this.db.query(
      `SELECT ${workbookColumns} FROM amp_workbooks WHERE learner_id=$1 AND code=$2
        ORDER BY created_at DESC LIMIT 1`,
      [this.learnerId, code],
    );
    return result.rows[0] ? workbookRow(result.rows[0]) : undefined;
  }
  async recentWorkbooks() {
    const result = await this.db.query(
      `SELECT ${workbookColumns} FROM amp_workbooks WHERE learner_id=$1
        AND created_at>now()-interval '24 hours' ORDER BY created_at DESC LIMIT 20`,
      [this.learnerId],
    );
    return result.rows.map(workbookRow);
  }
  async trialRemaining() {
    return (await this.trialProgress())?.remaining ?? null;
  }
  async hasAccess() {
    const learner = await this.learner();
    // A practice profile has no grant: the account's own access covers it.
    if (learner?.simulation)
      return profilesCovered(this.db, learner.account_id as string);
    if (learner?.adult)
      await refreshAdultAccess(
        this.db,
        learner.account_id as string,
        this.learnerId,
      );
    const result = await this.db.query(
      "SELECT 1 FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<=now() AND ends_at>now() LIMIT 1",
      [this.learnerId],
    );
    return !!result.rowCount;
  }
  async freeAllowance() {
    const { rows } = await this.db.query(
      "SELECT free_online_used,free_workbooks_used FROM amp_learners WHERE id=$1",
      [this.learnerId],
    );
    return freeAllowance(rows[0].free_online_used, rows[0].free_workbooks_used);
  }
  private async chargeFreeOnline() {
    if (await this.hasAccess()) return;
    await this.db.query(
      "UPDATE amp_learners SET free_online_used=LEAST(100,free_online_used+1) WHERE id=$1",
      [this.learnerId],
    );
  }
}
