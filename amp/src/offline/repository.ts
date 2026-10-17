import { createHash, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  generatedProblemSchema,
  type GeneratedProblem,
  type TemplateMetadata,
} from "../math/contracts.js";
import { generateProblem, templates } from "../math/engine.js";
import { skills } from "../curriculum/catalog.js";
import { PgTransaction, ApiError } from "../server/repository.js";
import {
  lockLearningAccount,
  learningConsentActive,
} from "../server/account-access.js";
import {
  planMixedPractice,
  type PracticeChoice,
} from "../server/mixed-practice.js";
import { gradeOfflineV1, isValidResponse } from "./grader-v1.js";
import {
  packSchema,
  type IssueInput,
  type OfflinePack,
  type ReconcileInput,
} from "./contracts.js";
import type { PackSigner } from "./signing.js";

export function supportedOfflineTemplates(
  input: IssueInput,
  available: readonly TemplateMetadata[] = templates,
) {
  return available.filter(
    (t) =>
      (!t.requiredResponseCapability ||
        input.responseCapabilities.includes(t.requiredResponseCapability)) &&
      (!t.requiredFigureCapability ||
        input.figureCapabilities.includes(t.requiredFigureCapability)),
  );
}
export function uniquePoolChoices(
  choices: readonly PracticeChoice[],
): PracticeChoice[] {
  return choices.filter(
    (choice, i) =>
      choices.findIndex((prior) => prior.template.id === choice.template.id) ===
      i,
  );
}
export class OfflineRepository {
  constructor(
    private pool: Pool,
    private signer: PackSigner,
  ) {}
  private async transaction<T>(
    account: string,
    learner: string,
    run: (client: PoolClient, revision: string, now: Date) => Promise<T>,
  ): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SET LOCAL statement_timeout='15s'");
      await lockLearningAccount(c, account);
      const owned = await c.query(
        "SELECT 1 FROM amp_learners WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL FOR UPDATE",
        [learner, account],
      );
      if (!owned.rowCount) throw new ApiError(404, "offline_learner_not_found");
      if (!(await learningConsentActive(c, account)))
        throw new ApiError(403, "offline_consent_required");
      const consent = await c.query(
        "SELECT offline_revision::text AS revision FROM amp_parent_consents WHERE account_id=$1 AND withdrawn_at IS NULL FOR SHARE",
        [account],
      );
      if (!consent.rowCount)
        throw new ApiError(403, "offline_consent_required");
      const now = (await c.query("SELECT clock_timestamp() AS now")).rows[0]
        .now as Date;
      const result = await run(c, consent.rows[0].revision, now);
      await c.query("COMMIT");
      return result;
    } catch (error) {
      await c.query("ROLLBACK");
      throw error;
    } finally {
      c.release();
    }
  }
  private async eligible(
    c: PoolClient,
    learner: string,
    id: string,
    revision: string,
    now: Date,
    account: string,
  ) {
    const result = await c.query(
      `SELECT p.*,g.status AS grant_status,g.offline_revision AS current_grant_revision,g.starts_at AS current_start,g.ends_at AS current_end,(g.starts_at=p.grant_start AND g.ends_at=p.grant_end) AS interval_unchanged
      FROM amp_offline_packs p JOIN amp_grants g ON g.id=p.grant_id
      WHERE p.id=$1 AND p.learner_id=$2 FOR SHARE OF g`,
      [id, learner],
    );
    const p = result.rows[0];
    now = (await c.query("SELECT clock_timestamp() AS now")).rows[0].now;
    if (!(await learningConsentActive(c, account)))
      throw new ApiError(403, "offline_consent_required");
    if (!p) throw new ApiError(404, "offline_pack_not_found");
    if (
      p.binding.serviceId !== this.signer.serviceId ||
      p.binding.accountBinding !== this.signer.bind("account", [account]) ||
      String(p.consent_revision) !== revision ||
      String(p.grant_revision) !== String(p.current_grant_revision) ||
      p.grant_status !== "active" ||
      p.expires_at <= now ||
      p.current_start > now ||
      p.current_end <= now ||
      !p.interval_unchanged
    )
      throw new ApiError(403, "offline_pack_no_longer_eligible");
    return p;
  }
  async issue(account: string, learner: string, input: IssueInput) {
    return this.transaction(account, learner, async (c, revision, now) => {
      const digest = createHash("sha256")
        .update(
          JSON.stringify([
            input.responseCapabilities,
            input.figureCapabilities,
          ]),
        )
        .digest("hex");
      const old = (
        await c.query(
          "SELECT id,request_digest FROM amp_offline_packs WHERE learner_id=$1 AND request_id=$2",
          [learner, input.requestId],
        )
      ).rows[0];
      if (old) {
        if (old.request_digest !== digest)
          throw new ApiError(409, "offline_request_conflict");
        const p = await this.eligible(
          c,
          learner,
          old.id,
          revision,
          now,
          account,
        );
        return { packId: p.id, signedPack: p.signed_pack };
      }
      const quotas = (
        await c.query(
          `SELECT count(*) FILTER(WHERE p.expires_at>$2 AND p.binding->>'serviceId'=$4 AND p.binding->>'accountBinding'=$5 AND p.consent_revision=$3 AND p.grant_revision=g.offline_revision AND g.status='active' AND g.starts_at<=$2 AND g.ends_at>$2 AND g.starts_at=p.grant_start AND g.ends_at=p.grant_end) AS active,count(*) FILTER(WHERE p.issued_at>$2::timestamptz-interval '24 hours') AS daily FROM amp_offline_packs p JOIN amp_grants g ON g.id=p.grant_id WHERE p.learner_id=$1`,
          [
            learner,
            now,
            revision,
            this.signer.serviceId,
            this.signer.bind("account", [account]),
          ],
        )
      ).rows[0];
      if (Number(quotas.active) >= 2 || Number(quotas.daily) >= 4)
        throw new ApiError(429, "offline_pack_limit");
      const grant = (
        await c.query(
          `SELECT id,offline_revision::text AS revision,starts_at,ends_at,starts_at::text AS starts_exact,ends_at::text AS ends_exact FROM amp_grants WHERE learner_id=$1 AND status='active' AND starts_at<=$2 AND ends_at>$2 ORDER BY ends_at DESC,id LIMIT 1 FOR SHARE`,
          [learner, now],
        )
      ).rows[0];
      now = (await c.query("SELECT clock_timestamp() AS now")).rows[0].now;
      if (!grant || grant.ends_at <= now || grant.starts_at > now)
        throw new ApiError(403, "offline_license_required");
      if (!(await learningConsentActive(c, account)))
        throw new ApiError(403, "offline_consent_required");
      const tx = new PgTransaction(c, learner);
      const supported = supportedOfflineTemplates(input);
      if (!supported.length)
        throw new ApiError(409, "offline_no_supported_content");
      const packId = randomUUID();
      const choices = uniquePoolChoices(
        planMixedPractice({
          templates: supported,
          skills,
          attempts: await tx.recentAttempts(),
          evidence: await tx.skillEvidence(),
          frontier: await tx.frontier(now.getTime()),
          count: 5,
          seed: packId,
          now: now.getTime(),
          strictCeiling: true,
        }),
      );
      if (!choices.length)
        throw new ApiError(409, "offline_no_eligible_content");
      const originals: GeneratedProblem[] = [];
      const items: OfflinePack["items"] = [];
      for (let variant = 0; variant < 3; variant++)
        for (const choice of choices) {
          const problem = generatedProblemSchema.parse(
            generateProblem(
              choice.template.id,
              `offline-v1:${packId}:${variant}:${choice.template.id}`,
            ),
          );
          originals.push(problem);
          items.push({
            problem: problem.public,
            graderVersion: 1,
            reason: variant === 0 ? choice.reason : "variant",
            strand: choice.strand,
            selfCheck: {
              answer: problem.answer,
              hint: problem.hint,
              explanation: problem.explanation,
            },
          });
        }
      const expires = new Date(
        Math.min(now.getTime() + 86400000, grant.ends_at.getTime()),
      );
      const pack = packSchema.parse({
        format: "amp-offline-v1",
        serviceId: this.signer.serviceId,
        accountBinding: this.signer.bind("account", [account]),
        authorization: {
          consentRevision: this.signer.bind("consent", [account, revision]),
          grantBinding: this.signer.bind("grant", [
            grant.id,
            grant.revision,
            grant.starts_exact,
            grant.ends_exact,
          ]),
        },
        packId,
        learnerId: learner,
        issuedAt: now.toISOString(),
        expiresAt: expires.toISOString(),
        selectionPolicy: "mixed-five-three-variants-v1",
        evidence: "offline-provisional",
        capabilities: {
          responseCapabilities: input.responseCapabilities,
          figureCapabilities: input.figureCapabilities,
        },
        items,
      });
      const signedPack = await this.signer.sign(pack);
      await c.query(
        `INSERT INTO amp_offline_packs(id,learner_id,request_id,request_digest,consent_revision,grant_id,grant_start,grant_end,issued_at,expires_at,signed_pack,binding,grant_revision) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          packId,
          learner,
          input.requestId,
          digest,
          revision,
          grant.id,
          grant.starts_exact,
          grant.ends_exact,
          now,
          expires,
          signedPack,
          JSON.stringify({
            serviceId: pack.serviceId,
            accountBinding: pack.accountBinding,
            authorization: pack.authorization,
          }),
          grant.revision,
        ],
      );
      for (const [ordinal, problem] of originals.entries())
        await c.query(
          "INSERT INTO amp_offline_instances(id,pack_id,ordinal,grader_version,content) VALUES($1,$2,$3,1,$4)",
          [problem.public.id, packId, ordinal, JSON.stringify(problem)],
        );
      return { packId, signedPack };
    });
  }
  async preflight(account: string, learner: string, packId: string) {
    return this.transaction(account, learner, async (c, revision, now) => {
      const pack = await this.eligible(
        c,
        learner,
        packId,
        revision,
        now,
        account,
      );
      return {
        ...pack.binding,
        learnerId: learner,
        eligible: true as const,
        packId,
        expiresAt: pack.expires_at.toISOString(),
        evidence: "offline-provisional" as const,
      };
    });
  }
  async reconcile(
    account: string,
    learner: string,
    packId: string,
    input: ReconcileInput,
  ) {
    return this.transaction(account, learner, async (c, revision, now) => {
      await this.eligible(c, learner, packId, revision, now, account);
      const results: Record<string, unknown>[] = [];
      for (const attempt of input.attempts) {
        const digest = createHash("sha256")
          .update(JSON.stringify([attempt.problemId, attempt.response]))
          .digest("hex");
        const prior = (
          await c.query(
            "SELECT input_digest,result FROM amp_offline_receipts WHERE pack_id=$1 AND request_id=$2",
            [packId, attempt.requestId],
          )
        ).rows[0];
        if (prior) {
          results.push(
            prior.input_digest === digest
              ? {
                  ...prior.result,
                  status:
                    prior.result.status === "accepted"
                      ? "replay"
                      : prior.result.status,
                  replayed: true,
                }
              : {
                  requestId: attempt.requestId,
                  problemId: attempt.problemId,
                  status: "conflict",
                  code: "request_reused",
                },
          );
          continue;
        }
        const count = (
          await c.query(
            "SELECT count(*)::int AS n FROM amp_offline_receipts WHERE pack_id=$1",
            [packId],
          )
        ).rows[0].n;
        if (count >= 60) {
          results.push({
            requestId: attempt.requestId,
            problemId: attempt.problemId,
            status: "rejected",
            code: "receipt_limit",
          });
          continue;
        }
        let result: Record<string, unknown> = {
          requestId: attempt.requestId,
          problemId: attempt.problemId,
          status: "rejected",
          code: "problem_not_found",
        };
        const original = (
          await c.query(
            "SELECT grader_version,content FROM amp_offline_instances WHERE pack_id=$1 AND id=$2",
            [packId, attempt.problemId],
          )
        ).rows[0];
        if (original) {
          const problem = generatedProblemSchema.parse(original.content);
          const existing = (
            await c.query(
              "SELECT 1 FROM amp_offline_attempts WHERE problem_id=$1",
              [attempt.problemId],
            )
          ).rowCount;
          if (existing)
            result = {
              ...result,
              status: "conflict",
              code: "problem_already_answered",
            };
          else if (original.grader_version !== 1)
            result = { ...result, code: "grader_unavailable" };
          else if (!isValidResponse(problem.public, attempt.response))
            result = { ...result, code: "invalid_response" };
          else {
            const saved = (
              await c.query(
                "INSERT INTO amp_offline_attempts(id,pack_id,problem_id,request_id,response,correct) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,correct,received_at",
                [
                  randomUUID(),
                  packId,
                  attempt.problemId,
                  attempt.requestId,
                  attempt.response,
                  gradeOfflineV1(problem, attempt.response),
                ],
              )
            ).rows[0];
            result = {
              requestId: attempt.requestId,
              problemId: attempt.problemId,
              status: "accepted",
              attemptId: saved.id,
              correct: saved.correct,
              receivedAt: saved.received_at.toISOString(),
              evidence: "offline-provisional",
            };
          }
        }
        await c.query(
          "INSERT INTO amp_offline_receipts(pack_id,request_id,input_digest,result) VALUES($1,$2,$3,$4)",
          [packId, attempt.requestId, digest, JSON.stringify(result)],
        );
        results.push(result);
      }
      return { evidence: "offline-provisional" as const, results };
    });
  }
}
