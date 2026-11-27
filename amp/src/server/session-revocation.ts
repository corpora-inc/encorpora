import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { recordEvent } from "../schools/events.js";
import { RESET_HASH_PREFIX } from "./session-tokens.js";

/** Whose sessions an incident lead ends (docs/incident-response.md):
 *
 * - `account`: one account (`amp|<user>` or a student's `school:<person>`):
 *   its own sign-ins, its school sign-ins, and the student sessions of every
 *   learner it owns (a family's children) or person it is.
 * - `org`: everyone with a current role or enrollment in the org or any org
 *   under it. An adult's sign-in is the account's, not the org's: an adult in
 *   the org is signed out everywhere.
 * - `all`: every session AMP holds.
 *
 * Account sessions and unused password-reset links are deleted; student and
 * provider sessions are marked revoked, as a teacher's "Sign out everywhere"
 * does. Each holder's next request is answered 401. An open live-class
 * stream ends on its own within 95 seconds and cannot reopen. */
export type RevokeScope =
  | { kind: "account"; accountId: string }
  | { kind: "org"; orgId: string }
  | { kind: "all" };

export type RevokeCounts = {
  accountSessions: number;
  studentSessions: number;
  providerSessions: number;
  resetLinks: number;
};

export class RevokeScopeError extends Error {}

const ACCOUNT = /^(amp\|[^\s,]{1,200}|school:[0-9a-f-]{36})$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** The rows in scope, as CTEs over `$1`: `people` (student sessions),
 * `accounts` (provider sessions) and `users` (Better Auth sign-ins and reset
 * links). `all` has none: every row is in scope. */
function scopeSql(scope: RevokeScope): { with: string[]; params: unknown[] } {
  const users = `users(id) AS (
      SELECT substr(id,5) FROM accounts WHERE id LIKE 'amp|%'
      UNION SELECT pp.auth_user_id FROM amp_provider_principals pp
        WHERE pp.account_id IN (SELECT id FROM accounts) AND pp.auth_user_id IS NOT NULL)`;
  if (scope.kind === "account")
    return {
      params: [scope.accountId],
      with: [
        `accounts(id) AS (SELECT $1::text)`,
        `people(id) AS (
          SELECT p.id FROM amp_people p WHERE p.account_id=$1::text
          UNION SELECT p.id FROM amp_people p JOIN amp_learners l ON l.id=p.learner_id
            WHERE l.account_id=$1::text)`,
        users,
      ],
    };
  if (scope.kind === "org")
    return {
      params: [scope.orgId],
      with: [
        `orgs(id) AS (SELECT id FROM amp_orgs WHERE path @> ARRAY[$1::uuid])`,
        `people(id) AS (
          SELECT r.person_id FROM amp_org_roles r
            WHERE r.org_id IN (SELECT id FROM orgs) AND (r.end_on IS NULL OR r.end_on>current_date)
          UNION SELECT e.person_id FROM amp_enrollments e JOIN amp_classes c ON c.id=e.class_id
            WHERE c.org_id IN (SELECT id FROM orgs) AND (e.end_on IS NULL OR e.end_on>current_date))`,
        `accounts(id) AS (
          SELECT DISTINCT p.account_id FROM amp_people p
            WHERE p.id IN (SELECT id FROM people) AND p.account_id IS NOT NULL)`,
        users,
      ],
    };
  return { params: [], with: [] };
}

/** Each kind of session: the rows in scope, and how they end. */
function steps(scoped: boolean) {
  const inScope = (sql: string) => (scoped ? sql : "TRUE");
  return {
    accountSessions: {
      table: "amp_auth_sessions",
      where: inScope(`"userId" IN (SELECT id FROM users)`),
      end: "DELETE",
    },
    studentSessions: {
      table: "amp_student_sessions",
      where: `${inScope("person_id IN (SELECT id FROM people)")} AND revoked_at IS NULL AND expires_at>now()`,
      end: "REVOKE",
    },
    providerSessions: {
      table: "amp_provider_sessions",
      where: `${inScope(
        "identity_id IN (SELECT i.id FROM amp_provider_identities i WHERE i.account_id IN (SELECT id FROM accounts))",
      )} AND revoked_at IS NULL AND expires_at>now()`,
      end: "REVOKE",
    },
    resetLinks: {
      table: "amp_auth_verifications",
      where: `${inScope("value IN (SELECT id FROM users)")} AND (identifier LIKE 'reset-password:%' OR identifier LIKE '${RESET_HASH_PREFIX}%')`,
      end: "DELETE",
    },
  } satisfies Record<
    keyof RevokeCounts,
    { table: string; where: string; end: "DELETE" | "REVOKE" }
  >;
}

async function assertScopeExists(db: PoolClient, scope: RevokeScope) {
  if (scope.kind === "all") return;
  if (scope.kind === "org") {
    if (!UUID.test(scope.orgId))
      throw new RevokeScopeError("--org takes an org id (a UUID)");
    const found = await db.query("SELECT 1 FROM amp_orgs WHERE id=$1", [
      scope.orgId,
    ]);
    if (!found.rowCount) throw new RevokeScopeError("No org has that id");
    return;
  }
  if (!ACCOUNT.test(scope.accountId))
    throw new RevokeScopeError(
      "--account takes an account id: amp|<user id> or school:<person id>",
    );
  const found = await db.query(
    `SELECT 1 WHERE EXISTS(SELECT 1 FROM amp_auth_users WHERE $1 LIKE 'amp|%' AND id=substr($1,5))
       OR EXISTS(SELECT 1 FROM amp_provider_principals WHERE account_id=$1)
       OR EXISTS(SELECT 1 FROM amp_people WHERE account_id=$1)
       OR EXISTS(SELECT 1 FROM amp_learners WHERE account_id=$1)`,
    [scope.accountId],
  );
  if (!found.rowCount) throw new RevokeScopeError("No account has that id");
}

/** Ends every session in `scope`, in one transaction, and records one
 * operator event (and, for an org, one entry in its activity history). With
 * `dryRun`, counts the same rows in a read-only transaction and writes
 * nothing. Returns counts only. */
export async function revokeSessions(
  pool: Pool,
  scope: RevokeScope,
  { dryRun }: { dryRun: boolean },
): Promise<RevokeCounts> {
  const db = await pool.connect();
  let discard = false;
  try {
    await db.query(dryRun ? "BEGIN READ ONLY" : "BEGIN");
    // A containment run waits for no one for long: retry it instead.
    await db.query("SET LOCAL lock_timeout = '10s'");
    await db.query("SET LOCAL statement_timeout = '120s'");
    await assertScopeExists(db, scope);
    const { with: ctes, params } = scopeSql(scope);
    const counts = {} as RevokeCounts;
    for (const [key, step] of Object.entries(steps(scope.kind !== "all"))) {
      const action =
        step.end === "DELETE"
          ? `DELETE FROM ${step.table} WHERE ${step.where} RETURNING 1`
          : `UPDATE ${step.table} SET revoked_at=now() WHERE ${step.where} RETURNING 1`;
      const all = dryRun ? [...ctes] : [...ctes, `ended AS (${action})`];
      const sql = `${all.length ? `WITH ${all.join(",\n")}\n` : ""}SELECT count(*)::int AS n FROM ${
        dryRun ? `${step.table} WHERE ${step.where}` : "ended"
      }`;
      const { rows } = await db.query<{ n: number }>(sql, params);
      counts[key as keyof RevokeCounts] = rows[0]!.n;
    }
    if (!dryRun) {
      await db.query(
        `INSERT INTO amp_operator_events(id,action,scope,target_id,detail)
         VALUES($1,'sessions.revoked',$2,$3,$4)`,
        [
          randomUUID(),
          scope.kind,
          scope.kind === "account"
            ? scope.accountId
            : scope.kind === "org"
              ? scope.orgId
              : null,
          JSON.stringify(counts),
        ],
      );
      if (scope.kind === "org")
        await recordEvent(db, {
          orgId: scope.orgId,
          action: "signin.sessions-revoked",
          targetKind: "org",
          targetId: scope.orgId,
          detail: { after: counts },
        });
    }
    await db.query(dryRun ? "ROLLBACK" : "COMMIT");
    return counts;
  } catch (error) {
    try {
      await db.query("ROLLBACK");
    } catch {
      discard = true;
    }
    throw error;
  } finally {
    db.release(discard);
  }
}

/** `--account <id> | --org <id> | --all [--dry-run]`. */
export function parseRevokeArguments(argv: readonly string[]): {
  scope: RevokeScope;
  dryRun: boolean;
} {
  const args = [...argv];
  let dryRun = false;
  const scopes: RevokeScope[] = [];
  while (args.length) {
    const flag = args.shift()!;
    if (flag === "--dry-run") dryRun = true;
    else if (flag === "--all") scopes.push({ kind: "all" });
    else if (flag === "--account" || flag === "--org") {
      const value = args.shift();
      if (!value || value.startsWith("--"))
        throw new RevokeScopeError(`${flag} needs an id`);
      scopes.push(
        flag === "--account"
          ? { kind: "account", accountId: value }
          : { kind: "org", orgId: value },
      );
    } else throw new RevokeScopeError(`Unknown argument: ${flag}`);
  }
  if (scopes.length !== 1)
    throw new RevokeScopeError(
      "Name one scope: --account <id>, --org <id> or --all",
    );
  return { scope: scopes[0]!, dryRun };
}
