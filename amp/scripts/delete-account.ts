import { pathToFileURL } from "node:url";
import type { Pool } from "pg";
import {
  AccountDeletionError,
  deleteAccount,
  type DeletionResult,
} from "../src/account/delete-account.js";
import { SchoolError } from "../src/schools/contracts.js";
import { createDatabasePool } from "../src/server/database.js";

/**
 * Deletes one AMP account by its sign-in email, exactly as "Delete my
 * account" does (src/account/delete-account.ts), for an operator:
 *
 *   AMP_DATABASE_URL=… npx tsx scripts/delete-account.ts --email a@b.example --dry-run
 *   AMP_DATABASE_URL=… npx tsx scripts/delete-account.ts --email a@b.example --commit
 *
 * A dry run does the whole deletion in a transaction, prints the rows it
 * would delete or change per table, and rolls back. `--commit` deletes and
 * writes the journal row. One of the two is required. A renewing plan or a
 * school with a paid license refuses either, naming what to do first.
 *
 * Run it on an operator's machine, never in an API pod: production goes
 * through the endpoint, or through this script against a local export.
 */
export async function deleteAccountByEmail(
  pool: Pool,
  email: string,
  commit: boolean,
): Promise<DeletionResult> {
  const users = (
    await pool.query<{ id: string }>(
      "SELECT id FROM amp_auth_users WHERE lower(email)=lower($1)",
      [email.trim()],
    )
  ).rows;
  if (users.length !== 1)
    throw new AccountDeletionError(404, "account_not_found");
  return deleteAccount(pool, {
    accountId: `amp|${users[0]!.id}`,
    via: "operator",
    commit,
  });
}

function argument(name: string) {
  const at = process.argv.indexOf(name);
  return at < 0 ? undefined : process.argv[at + 1];
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const email = argument("--email");
  const dryRun = process.argv.includes("--dry-run");
  const commit = process.argv.includes("--commit");
  if (process.env.KUBERNETES_SERVICE_HOST)
    throw new Error(
      "Run delete-account on an operator's machine, not in a pod.",
    );
  if (!process.env.AMP_DATABASE_URL || !email || dryRun === commit)
    throw new Error(
      "Set AMP_DATABASE_URL and pass --email <address> with --dry-run or --commit.",
    );
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    const result = await deleteAccountByEmail(pool, email, commit);
    // Ids, kinds and counts: no names or addresses.
    console.log(
      JSON.stringify(
        {
          accountId: result.accountId,
          committed: result.committed,
          removed: result.removed.map(({ id, kind }) => ({ id, kind })),
          left: result.left.map(({ id, kind }) => ({ id, kind })),
          counts: result.counts,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        error:
          error instanceof AccountDeletionError || error instanceof SchoolError
            ? error.code
            : "delete_account_failed",
        ...(error instanceof AccountDeletionError && error.blockers.length
          ? { blockers: error.blockers }
          : {}),
      }),
    );
    if (!(
      error instanceof AccountDeletionError || error instanceof SchoolError
    ))
      console.error(error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
