import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { Kysely, PostgresDialect } from "kysely";
import { kyselyAdapter } from "@better-auth/kysely-adapter";
import type { BetterAuthOptions } from "@better-auth/core";
import type { DBAdapter, Where } from "@better-auth/core/db/adapter";

/** A stored account session token: its SHA-256, never the token itself, so a
 * copy of the database holds no session that works (issue #2555). The token
 * Better Auth issues is 32 letters and digits; it never starts with this. */
export const SESSION_HASH_PREFIX = "sha256:";
export const hashSessionToken = (token: string) =>
  `${SESSION_HASH_PREFIX}${createHash("sha256").update(token, "utf8").digest("hex")}`;
/** The same, in SQL, for migrating stored rows (`token` is the column). */
export const HASH_SESSION_TOKEN_SQL = `'${SESSION_HASH_PREFIX}' || encode(sha256(convert_to(token,'UTF8')),'hex')`;

/** Stored password-reset identifiers start with this: `reset-password:` and
 * the token, hashed (`verification.storeIdentifier` in accounts.ts). */
export const RESET_HASH_PREFIX = "reset-password-sha256:";

type Row = Record<string, unknown>;
type AnyAdapter = DBAdapter<BetterAuthOptions>;

/** Better Auth 1.7 stores the session token as issued and has no option to
 * hash it. This wraps the database adapter for the `session` model only:
 *
 * - a lookup by token (find, update, delete, consume, count) matches its hash,
 *   or the token itself while rows written before hashing remain. A presented
 *   value that is already a stored hash is only ever hashed again, so it never
 *   matches: a stored row cannot be replayed as a token.
 * - a row found that way comes back carrying the token that was presented, as
 *   Better Auth expects (it sets the cookie and returns it to the client).
 * - with `hashOnWrite`, a new session is stored as its hash, and a row still
 *   stored as issued is rehashed when it is next used. The release before
 *   (0157) only read hashes, so every API pod could already read them before
 *   any pod wrote one (a pod mid-rollout would otherwise sign out whoever it
 *   served).
 *
 * Lookups by anything else (a user's session list) return the stored hash. AMP
 * turns off the endpoints that would hand those to a client or act on them
 * (`/list-sessions`, `/revoke-session`, `/revoke-other-sessions`). */
export function sessionTokenAdapter(
  inner: AnyAdapter,
  options: { hashOnWrite: boolean },
): AnyAdapter {
  const wrap = (adapter: AnyAdapter): AnyAdapter => {
    const lookup = (model: string, where: Where[] | undefined) => {
      const presented = new Map<string, string>();
      if (model !== "session" || !where) return { where, presented };
      const candidates = (token: string) => {
        const hashed = hashSessionToken(token);
        presented.set(hashed, token);
        // Not yet hashed rows: only a value that could be a token as issued.
        if (token.startsWith(SESSION_HASH_PREFIX)) return [hashed];
        presented.set(token, token);
        return [hashed, token];
      };
      return {
        presented,
        where: where.map((clause): Where => {
          if (clause.field !== "token") return clause;
          const operator = clause.operator ?? "eq";
          if (operator === "eq" && typeof clause.value === "string")
            return {
              ...clause,
              operator: "in",
              value: candidates(clause.value),
            };
          if (operator === "in" && Array.isArray(clause.value))
            return {
              ...clause,
              value: (clause.value as unknown[]).flatMap((token) =>
                typeof token === "string" ? candidates(token) : [],
              ),
            };
          throw new Error(
            `session token lookups support eq and in, not ${operator}`,
          );
        }),
      };
    };
    const restore = <T>(row: T, presented: Map<string, string>): T => {
      if (!row || typeof row !== "object") return row;
      const token = (row as Row).token;
      if (typeof token !== "string" || !presented.has(token)) return row;
      return { ...(row as Row), token: presented.get(token) } as T;
    };
    /** A row an older pod stored as issued, found by its token: stored as
     * the hash from now on. A failure is logged; the next lookup retries. */
    const upgrade = async (target: AnyAdapter, model: string, row: unknown) => {
      if (!options.hashOnWrite || model !== "session") return;
      const found = row as Row | null;
      if (
        !found ||
        typeof found.id !== "string" ||
        typeof found.token !== "string" ||
        found.token.startsWith(SESSION_HASH_PREFIX)
      )
        return;
      try {
        await target.update({
          model: "session",
          where: [{ field: "id", value: found.id }],
          update: { token: hashSessionToken(found.token) },
        });
      } catch (error) {
        console.error("[accounts] session token not rehashed", error);
      }
    };
    const storable = (model: string, data: Row): Row =>
      model === "session" && typeof data.token === "string"
        ? options.hashOnWrite && !data.token.startsWith(SESSION_HASH_PREFIX)
          ? { ...data, token: hashSessionToken(data.token) }
          : data
        : data;
    return {
      ...adapter,
      async create(input) {
        const data = input.data as Row;
        const stored = storable(input.model, data);
        const row = await adapter.create({ ...input, data: stored as never });
        if (stored === data || !row || typeof row !== "object") return row;
        return { ...(row as Row), token: data.token } as never;
      },
      async findOne(input) {
        const { where, presented } = lookup(input.model, input.where);
        const row = await adapter.findOne({ ...input, where: where! });
        await upgrade(adapter, input.model, row);
        return restore(row, presented);
      },
      async findMany(input) {
        const { where, presented } = lookup(input.model, input.where);
        const rows = await adapter.findMany({ ...input, where });
        return rows.map((row) => restore(row, presented));
      },
      async count(input) {
        const { where } = lookup(input.model, input.where);
        return adapter.count({ ...input, where });
      },
      async update(input) {
        const { where, presented } = lookup(input.model, input.where);
        return restore(
          await adapter.update({
            ...input,
            where: where!,
            update: storable(input.model, input.update),
          }),
          presented,
        );
      },
      async updateMany(input) {
        const { where } = lookup(input.model, input.where);
        return adapter.updateMany({
          ...input,
          where: where!,
          update: storable(input.model, input.update),
        });
      },
      async delete(input) {
        const { where } = lookup(input.model, input.where);
        return adapter.delete({ ...input, where: where! });
      },
      async deleteMany(input) {
        const { where } = lookup(input.model, input.where);
        return adapter.deleteMany({ ...input, where: where! });
      },
      async consumeOne(input) {
        const { where, presented } = lookup(input.model, input.where);
        return restore(
          await adapter.consumeOne({ ...input, where: where! }),
          presented,
        );
      },
      async incrementOne(input) {
        const { where, presented } = lookup(input.model, input.where);
        return restore(
          await adapter.incrementOne({ ...input, where: where! }),
          presented,
        );
      },
      // A transaction's own adapter is wrapped the same way.
      ...(adapter.transaction && {
        transaction: (callback: Parameters<AnyAdapter["transaction"]>[0]) =>
          adapter.transaction((trx) =>
            callback(wrap(trx as AnyAdapter) as never),
          ),
      }),
    } as AnyAdapter;
  };
  return wrap(inner);
}

/** The adapter Better Auth would build for a `pg` pool (`createKyselyAdapter`:
 * PostgreSQL, transactions on), with session tokens stored hashed. */
export function accountsDatabase(
  pool: Pool,
  options: { hashOnWrite: boolean },
): (auth: BetterAuthOptions) => AnyAdapter {
  const db = new Kysely({ dialect: new PostgresDialect({ pool }) });
  return (auth) =>
    sessionTokenAdapter(
      kyselyAdapter(db, { type: "postgres", transaction: true })(auth),
      options,
    );
}
