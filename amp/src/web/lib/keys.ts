/**
 * Every TanStack Query key, spelled once (docs/architecture/frontend-patterns.md,
 * "Query keys"). A key is never written as an array literal anywhere else:
 * build it with `qk`, and name a new resource in `AccountResources`.
 *
 * Server data an account reads sits under `qk.account(id)`, so invalidating
 * that one prefix refreshes everything the account shows, and a sign-out or
 * an account change drops all of it.
 *
 * The resources are a type, so the registry costs the entry bundle nothing,
 * and each key's shape is still checked where it is built:
 * `qk.account(id, "receipts", cursor)` is
 * `readonly ["account", string, "receipts", string | null]`.
 */

/** Each of an account's resources, with the parts that follow its name. */
export type AccountResources = {
  /** The account's own record (`/me`). */
  me: [];
  /** The adult's own practice (`/me/practice`). */
  "own-practice": [];
  /** Purchases and plans (features/billing), and their parts: the offer,
   * the enrollment, one learner's status (`"status", learner`). */
  billing: [part?: string, ...rest: string[]];
  /** Education-fund invoices (features/pay/api.ts): the records, one
   * invoice, and an invoice's email (`"email", invoice`). */
  "funding-invoices": string[];
  /** The account's education-fund requests (features/funding/records.ts),
   * and one of them. */
  "funding-records": [invoice?: string];
  /** The account's education-fund invoices, as Billing lists them. */
  "funding-invoice-history": [];
  /** One education-fund invoice a parent is finishing. */
  "active-funding-invoice": [invoice: string];
  /** One learner's printed workbooks (features/workbooks/api.ts): their
   * history, areas, previews and results. */
  workbooks: [learner: string, ...part: unknown[]];
  /** A parent's consent: its status, and whether it can be given here. */
  consent: [part?: "availability"];
  /** The families this account belongs to, and each one's reads
   * (features/family/api.ts). */
  families: unknown[];
  /** The schools this account works in, and each one's reads
   * (features/school/api.ts). */
  school: unknown[];
  /** What deleting the account would remove. */
  deletion: [];
  /** Receipts, a page at a time (`null`: the first page). */
  receipts: [cursor: string | null];
  /** A second parent's invitation for this family. */
  "second-parent": [];
  /** Requests waiting for this parent's approval, and one of them. */
  "family-approvals": [];
  "family-approval": [request: string];
  /** One learner's level over time. */
  "level-trend": [learner: string];
  /** A learner's record on the map (Pathways), and on one skill
   * (lib/learning-view.ts). */
  pathways: [learner?: string, skill?: string];
  /** A learner's level estimate, as the map frames it. */
  "pathways-frontier": [learner?: string];
};
type Resource = keyof AccountResources;

/** The account a key belongs to: a session's `accountId`. `/me` is also
 * asked before any sign-in, under `null`. */
type Account = string | null;

function account<Id extends Account>(id: Id): readonly ["account", Id];
function account<Id extends Account, R extends Resource>(
  id: Id,
  resource: R,
  ...parts: AccountResources[R]
): readonly ["account", Id, R, ...AccountResources[R]];
function account(id: Account, ...leaf: unknown[]): readonly unknown[] {
  return ["account", id, ...leaf];
}

export const qk = {
  /** This browser's sign-in (lib/session.ts). */
  session: () => ["session"] as const,
  /** How this deployment signs people in. */
  authConfig: () => ["auth-config"] as const,
  /** The whole learning catalog the search corpus is built from
   * (features/search/search-corpus.ts): the same for every visitor. */
  searchCatalog: () => ["search-catalog"] as const,
  /** The curriculum's size for the school pitch (objectives, problem
   * types, lessons): the same for every visitor. */
  schoolsCurriculum: () => ["schools", "curriculum"] as const,
  /** Every account's data on this device: what a sign-out or another
   * person's account drops (app/providers.tsx). */
  accounts: () => ["account"] as const,
  /** A lesson's film, the same for every visitor (features/films). */
  lessonFilm: (templateId: string) => ["lesson-film", templateId] as const,
  /** A learner's practice settings, by who is practicing (an account, or
   * "guest") (features/practice/practice-settings.ts). */
  practiceSettings: (identity: string, learner: string) =>
    ["practice-settings", identity, learner] as const,
  /** What one answer changed, under its practice's scope (an account and
   * learner, never a credential) (features/practice/AnswerFeedback.tsx). */
  answerFeedback: (scope: readonly string[], outcome: string) =>
    [...scope, "answer-feedback", outcome] as const,
  /** One account's data, or one of its resources. */
  account,
  /** The plans' prices: the same for every visitor (features/billing). */
  prices: () => ["billing", "prices"] as const,
  /** The education-fund programs and their invoice offers (features/pay). */
  fundingOffers: () => ["funding", "invoice-offers"] as const,
  /** One program's public invoice offers (features/funding). */
  publicInvoiceOffers: (program: string) =>
    ["public-invoice-offers", program] as const,
  /** What an approval link names, read before anyone signs in
   * (features/family-approval). */
  familyApprovalLink: (token: string | undefined) =>
    ["family-approval-link", token] as const,
  /** A problem type's short lesson, as Pathways' lesson layer reads it
   * (features/pathways/lesson-query.ts): the same for every visitor. */
  pathwaysLesson: (templateId: string) =>
    ["pathways-lesson", templateId] as const,
};
