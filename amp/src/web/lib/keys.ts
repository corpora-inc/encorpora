/**
 * Every TanStack Query key, spelled once (docs/architecture/frontend-patterns.md,
 * "Query keys"). A key is never written as an array literal anywhere else:
 * call a builder here, or add one.
 *
 * Server data an account reads sits under `qk.account(id)`, so invalidating
 * that one prefix refreshes everything the account shows, and a sign-out or
 * an account change drops all of it (`qk.accounts()`). Data that is the same
 * for every visitor (prices, the catalog) sits under its own root.
 *
 * Builders return readonly tuples, so a key's shape is checked where it is
 * used: `qk.me(id)` is `readonly ["account", string, "me"]`.
 */

/** The account a key belongs to: a session's `accountId`. `/me` is also
 * asked before any sign-in, under `null`. */
type Account = string | null;

const account = <Id extends Account>(id: Id) => ["account", id] as const;

export const qk = {
  /** This browser's sign-in (lib/session.ts). */
  session: () => ["session"] as const,
  /** How this deployment signs people in. */
  authConfig: () => ["auth-config"] as const,

  /** Every account's data: removed when the signed-in account changes. */
  accounts: () => ["account"] as const,
  /** One account's data: invalidate it after any change the account made. */
  account,

  /** The account's own record (`/me`). */
  me: (id: Account) => [...account(id), "me"] as const,
  /** The adult's own practice (`/me/practice`). */
  ownPractice: (id: string) => [...account(id), "own-practice"] as const,
  /** What the account's purchases and plans are (features/billing). */
  billing: (id: string) => [...account(id), "billing"] as const,
  /** Whether a parent's consent can be given here. */
  consentAvailability: (id: string) =>
    [...account(id), "consent", "availability"] as const,
  /** The families this account belongs to, and each one's reads. */
  families: (id: string) => [...account(id), "families"] as const,
  /** The schools this account works in, and each one's reads. */
  school: (id: string) => [...account(id), "school"] as const,
  /** What deleting the account would remove. */
  deletion: (id: string) => [...account(id), "deletion"] as const,
  /** The account's receipts, a page at a time (`null`: the first page). */
  receipts: (id: string, cursor: string | null) =>
    [...account(id), "receipts", cursor] as const,
  /** A second parent's view of the family that invited them. */
  secondParent: (id: string) => [...account(id), "second-parent"] as const,
  /** Requests waiting for this parent's approval. */
  familyApprovals: (id: string) =>
    [...account(id), "family-approvals"] as const,
  /** One approval request. */
  familyApproval: (id: string, request: string) =>
    [...account(id), "family-approval", request] as const,
  /** One learner's level over time. */
  levelTrend: (id: string, learner: string) =>
    [...account(id), "level-trend", learner] as const,
};
