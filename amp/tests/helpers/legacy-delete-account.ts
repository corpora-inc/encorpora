// Legacy writer from origin/spaces (fdb159a40), frozen for rollout regression tests.
// Only import paths and formatting are adapted; keep the writer unaware of new tables.
import { rememberProviderPilotAliases } from "../../src/identity/provider-principals.js";
import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { FamilyRepository } from "../../src/family/repository.js";
import {
  FREE_LICENSE_REFERENCES,
  removeOrgTree,
} from "../../src/schools/org-delete.js";
import { activeToday } from "../../src/schools/principal.js";
import { SchoolRepository } from "../../src/schools/repository.js";
import { endStaffIn } from "../../src/schools/staff.js";
/** An AMP sign-in account (`src/server/accounts.ts`). */
const ACCOUNT_PREFIX = "amp|";
import type {
  DeletionBlocker,
  DeletionPreview,
} from "../../src/account/deletion-contracts.js";

/*
 * "Delete my account" (docs/families.md#deleting-an-account). One function,
 * used by the API (`POST /api/v1/account/delete`) and by the operator's
 * `scripts/delete-account.ts`, removes everything an account owns in one
 * transaction:
 *
 * - every place this person alone runs (their family, a school or class with
 *   no other admin, their own demos), through the operator's tree removal
 *   (`removeOrgTree`);
 * - their place in anything shared: their staff roles end as an admin's
 *   "Remove" would end them (`endStaffIn`), and their person row there stays
 *   only as a nameless tombstone, so the school's grades and history still
 *   add up;
 * - every learner they own (children, their own practice, profiles) with all
 *   learning records, through the learning-data deletion parents already use;
 * - every row keyed to the account, and the sign-in itself.
 *
 * What stays, and why, is `ACCOUNT_TABLES` below: payment records for the
 * financial retention period, completed consent evidence until its purge
 * date, and one journal row. Each table of the schema has an entry there, and
 * `tests/delete-account.integration.ts` fails when a table is added without
 * one.
 */

/** How each table is treated when an account is deleted. */
export type TableHandling =
  /** Rows keyed to the account are deleted here. */
  | "account"
  /** Goes with the sign-in (`amp_auth_users`), by foreign-key cascade. */
  | "sign-in"
  /** Goes with the account's learners. */
  | "learner"
  /** Goes with a place removed whole; in a shared place, the person's row
   * stays as a nameless tombstone and their roles end. */
  | "place"
  /** Payment records: kept for `RETENTION.financialRecordYears`, under the
   * account's opaque id, with any learner as a "Deleted learner" reference. */
  | "financial"
  /** Completed consent evidence: kept until its own purge date. Withdrawal
   * markers and requests that never completed go now. */
  | "consent-evidence"
  /** The journal of deletions. */
  | "journal"
  /** Holds nothing about a person: content, configuration, counts, or
   * analytics under a random visitor id. */
  | "none";

export const ACCOUNT_TABLES: Record<string, TableHandling> = {
  amp_academic_sessions: "place",
  amp_access_gifts: "account",
  amp_account_classification_events: "sign-in",
  amp_account_classifications: "sign-in",
  amp_account_deletions: "journal",
  amp_account_entitlements: "financial",
  amp_acquisition_contact_events: "sign-in",
  amp_acquisition_contacts: "sign-in",
  amp_acquisition_messages: "sign-in",
  amp_active_days: "learner",
  amp_ad_click_evidence: "account",
  amp_ad_click_journeys: "account",
  amp_ad_collection_withdrawals: "account",
  amp_ad_order_attribution: "account",
  amp_adult_activity: "learner",
  amp_advertising_permissions: "account",
  amp_attempts: "learner",
  amp_auth_accounts: "sign-in",
  amp_auth_passkeys: "sign-in",
  amp_auth_removed_identities: "sign-in",
  amp_auth_sessions: "sign-in",
  amp_auth_two_factors: "sign-in",
  amp_auth_users: "sign-in",
  amp_auth_verifications: "sign-in",
  amp_campaign_creative_daily: "none",
  amp_campaign_daily: "none",
  amp_classes: "place",
  amp_class_authorizations: "place",
  amp_class_pilots: "place",
  amp_teacher_pilots: "account",
  amp_pilot_eligibility: "journal",
  amp_pilot_extensions: "place",
  amp_school_starts: "account",
  amp_school_purchase_requests: "account",
  amp_school_connection_requests: "account",
  amp_school_connection_tasks: "place",
  amp_school_adoptions: "account",
  amp_courses: "place",
  amp_clever_connections: "place",
  amp_clever_bindings: "place",
  amp_clever_memberships: "place",
  amp_clever_sync_runs: "place",
  amp_classwallet_checkouts: "financial",
  amp_classwallet_payments: "financial",
  amp_commerce_events: "financial",
  amp_commerce_orders: "financial",
  amp_consent_outbox: "consent-evidence",
  amp_consent_policy: "none",
  amp_consent_requests: "consent-evidence",
  amp_content_releases: "none",
  amp_data_agreements: "place",
  amp_demo_schools: "none",
  amp_demo_snapshots: "none",
  amp_demo_visitors: "account",
  amp_engagement_pages: "none",
  amp_enrollment_cancellations: "financial",
  amp_enrollments: "place",
  amp_export_tickets: "account",
  amp_external_refs: "place",
  amp_families: "place",
  amp_family_approvals: "account",
  amp_frontier_states: "learner",
  amp_funded_activation_outbox: "financial",
  amp_funded_campaign_daily: "none",
  amp_funded_visitor_links: "none",
  amp_funding_invoice_intents: "financial",
  amp_funding_requests: "financial",
  amp_funnel_aggregates: "none",
  amp_funnel_checkouts: "financial",
  amp_funnel_events: "none",
  amp_funnel_visitors: "none",
  amp_ga_signup_exports: "sign-in",
  amp_google_collection_cursors: "none",
  amp_google_delivery_attempts: "account",
  amp_google_purchase_queue: "account",
  amp_google_signup_exports: "sign-in",
  amp_grants: "learner",
  amp_help_days: "learner",
  amp_help_events: "learner",
  amp_instances: "learner",
  amp_journey_actions: "none",
  amp_journey_generations: "account",
  amp_learner_weeks: "learner",
  amp_learners: "learner",
  amp_level_days: "learner",
  amp_meta_advertising_permissions: "account",
  amp_meta_collection_cursors: "none",
  amp_meta_delivery_attempts: "account",
  amp_meta_purchase_contexts: "account",
  amp_meta_purchase_queue: "account",
  amp_migrations: "none",
  amp_offline_attempts: "learner",
  amp_offline_instances: "learner",
  amp_offline_packs: "learner",
  amp_offline_receipts: "learner",
  amp_openai_advertising_permissions: "account",
  amp_openai_purchase_queue: "account",
  amp_openai_purchase_scan: "none",
  amp_org_roles: "place",
  amp_orgs: "place",
  amp_parent_assessment_entries: "sign-in",
  amp_parent_consents: "consent-evidence",
  amp_parent_feedback: "none",
  amp_parent_followup_outbox: "sign-in",
  amp_parent_followups: "sign-in",
  amp_parent_signup_intents: "sign-in",
  amp_payment_holds: "financial",
  amp_payment_observations: "financial",
  amp_payment_records: "financial",
  amp_people: "place",
  amp_person_credentials: "place",
  amp_practice_changes: "learner",
  amp_practice_settings: "learner",
  amp_privacy_events: "account",
  amp_problem_flags: "learner",
  amp_provider_signup_exports: "sign-in",
  amp_provider_principals: "account",
  amp_provider_identities: "account",
  amp_provider_sessions: "account",
  amp_provider_oauth_flows: "account",
  amp_purchase_consents: "consent-evidence",
  amp_school_events: "place",
  amp_school_licenses: "place",
  amp_scope_settings: "place",
  amp_seats: "place",
  amp_signup_browser_contexts: "sign-in",
  amp_skill_days: "learner",
  amp_skill_evidence: "learner",
  amp_stripe_checkouts: "financial",
  amp_stripe_customers: "financial",
  amp_stripe_inbox: "financial",
  amp_stripe_invoice_evidence: "financial",
  amp_stripe_subscription_events: "financial",
  amp_student_sessions: "place",
  amp_term_grades: "place",
  amp_trial_events: "account",
  amp_trials: "account",
  amp_visitor_journeys: "account",
  amp_workbooks: "learner",
};

export class AccountDeletionError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    readonly blockers: DeletionBlocker[] = [],
  ) {
    super(code);
  }
}

/** A Stripe checkout started this long ago can no longer be paid. */
const CHECKOUT_OPEN_MS = 24 * 3_600_000;

type Place = DeletionPreview["removed"][number];
type Plan = DeletionPreview & {
  userId: string | null;
  email: string | null;
  /** Places removed whole, with whether each is a demo. */
  owned: (Place & { demo: boolean })[];
  /** This account's person rows in shared places, by place. A demo's are a
   * visitor's place in made-up data. */
  leaving: { root: string; demo: boolean; people: string[] }[];
};

const rows = async <T = Record<string, unknown>>(
  client: Pick<PoolClient, "query">,
  sql: string,
  params: unknown[] = [],
) => (await client.query(sql, params)).rows as T[];

/** What deleting `accountId` would remove, and anything that must happen
 * first. Reads only. */
async function inspect(client: PoolClient, accountId: string): Promise<Plan> {
  const userId = accountId.startsWith(ACCOUNT_PREFIX)
    ? accountId.slice(ACCOUNT_PREFIX.length)
    : null;
  const email = userId
    ? ((
        await rows<{ email: string }>(
          client,
          "SELECT email FROM amp_auth_users WHERE id=$1",
          [userId],
        )
      )[0]?.email ?? null)
    : null;

  // Every place this account is a person in, and its own demos. A shared
  // demo school, and a visitor's place in it, are never this person's alone.
  const places = await rows<{
    id: string;
    name: string;
    kind: Place["kind"];
    demo: boolean;
    shared_demo: boolean;
    own_demo: boolean;
    mine: boolean;
    others: boolean;
    visitor: boolean;
    people: string[];
  }>(
    client,
    `WITH mine AS (
       SELECT p.id,p.demo_visitor,t.path[1] AS root FROM amp_people p
       JOIN amp_orgs t ON t.id=p.tenant_id WHERE p.account_id=$1
     ), roots AS (
       SELECT root AS id FROM mine
       UNION SELECT id FROM amp_orgs WHERE demo AND created_by=$1 AND parent_id IS NULL
     )
     SELECT o.id,o.name,o.kind,o.demo,
       COALESCE(o.created_by LIKE 'amp-demo:%',false) AS shared_demo,
       (o.demo AND o.created_by=$1) AS own_demo,
       (NOT EXISTS(SELECT 1 FROM amp_clever_connections c WHERE c.tenant_id=o.id) AND
       EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs ro ON ro.id=r.org_id
         JOIN amp_people p ON p.id=r.person_id
         WHERE ro.path[1]=o.id AND p.account_id=$1 AND r.role='admin' AND ${activeToday("r", "ro")}
           AND amp_school_role_current(r.id))) OR
       (o.kind='school' AND o.solo AND EXISTS(SELECT 1 FROM amp_school_starts ss WHERE ss.account_id=$1 AND ss.org_id=o.id)) AS mine,
       EXISTS(SELECT 1 FROM amp_org_roles r JOIN amp_orgs ro ON ro.id=r.org_id
         JOIN amp_people p ON p.id=r.person_id
         WHERE ro.path[1]=o.id AND p.account_id IS NOT NULL AND p.account_id<>$1
           AND p.deleted_at IS NULL AND (r.role='admin' OR o.kind='school' AND o.solo AND r.role IN ('teacher','staff')) AND ${activeToday("r", "ro")}) AS others,
       COALESCE(bool_or(m.demo_visitor),false) AS visitor,
       COALESCE(array_agg(m.id ORDER BY m.id) FILTER (WHERE m.id IS NOT NULL),'{}') AS people
     FROM roots JOIN amp_orgs o ON o.id=roots.id
     LEFT JOIN mine m ON m.root=o.id
     GROUP BY o.id ORDER BY o.created_at,o.id`,
    [accountId],
  );
  const owned: Plan["owned"] = [];
  const leaving: Plan["leaving"] = [];
  const left: Place[] = [];
  for (const place of places) {
    const summary = { id: place.id, name: place.name, kind: place.kind };
    if (
      place.own_demo ||
      (place.mine && !place.others && !place.shared_demo && !place.visitor)
    )
      owned.push({ ...summary, demo: place.demo });
    else {
      leaving.push({ root: place.id, demo: place.demo, people: place.people });
      // A demo is somewhere they looked around, not a place they belong to.
      if (!place.demo) left.push(summary);
    }
  }

  const blockers: DeletionBlocker[] = [];
  for (const place of owned.filter((place) => !place.demo))
    if (
      (
        await rows(
          client,
          `SELECT 1 FROM amp_school_licenses l JOIN amp_orgs o ON o.id=l.org_id
           WHERE o.path[1]=$1 AND l.status='active' AND l.starts_at<=now() AND l.ends_at>now()
             AND NOT lower(trim(COALESCE(l.reference,'')))=ANY($2::text[]) LIMIT 1`,
          [place.id, FREE_LICENSE_REFERENCES],
        )
      ).length
    )
      blockers.push({
        code: "school_licensed",
        orgId: place.id,
        name: place.name,
      });

  // A subscription that still renews would bill nobody: it is cancelled in
  // billing first. One cancelled at the period's end, or ended, is done.
  const checkouts = await rows<{
    subscription_id: string | null;
    session_id: string | null;
    created_at: Date;
    renews: boolean;
  }>(
    client,
    `SELECT c.subscription_id,c.session_id,c.created_at,
       NOT COALESCE((SELECT e.cancel_at_period_end OR e.status IN ('canceled','incomplete_expired')
         FROM amp_stripe_subscription_events e WHERE e.checkout_id=c.id
         ORDER BY e.observed_at DESC LIMIT 1),false) AS renews
     FROM amp_stripe_checkouts c WHERE c.account_id=$1 AND NOT c.closed`,
    [accountId],
  );
  if (checkouts.some((c) => c.subscription_id && c.renews))
    blockers.push({ code: "plan_renews" });
  const open = checkouts
    .filter(
      (c) =>
        !c.subscription_id &&
        c.session_id &&
        Date.now() - c.created_at.getTime() < CHECKOUT_OPEN_MS,
    )
    .map((c) => c.created_at.getTime() + CHECKOUT_OPEN_MS);
  if (open.length)
    blockers.push({
      code: "checkout_open",
      until: new Date(Math.max(...open)).toISOString(),
    });

  const learners = (
    await rows<{
      children: number;
      own: boolean;
      profiles: number;
      answers: number;
    }>(
      client,
      `SELECT count(*) FILTER (WHERE NOT l.adult AND NOT l.simulation)::int AS children,
         bool_or(l.adult AND NOT l.simulation) IS TRUE AS own,
         count(*) FILTER (WHERE l.simulation)::int AS profiles,
         (SELECT count(*)::int FROM amp_attempts a JOIN amp_learners x ON x.id=a.learner_id
          WHERE x.account_id=$1 AND x.deleted_at IS NULL) AS answers
       FROM amp_learners l WHERE l.account_id=$1 AND l.deleted_at IS NULL`,
      [accountId],
    )
  )[0]!;
  const secondParent = !!(
    await rows(
      client,
      "SELECT 1 FROM amp_families WHERE account_id=$1 AND second_parent IS NOT NULL",
      [accountId],
    )
  ).length;
  const billingRecords = !!(
    await rows(
      client,
      `SELECT 1 FROM amp_stripe_checkouts WHERE account_id=$1
       UNION ALL SELECT 1 FROM amp_commerce_orders WHERE account_id=$1 LIMIT 1`,
      [accountId],
    )
  ).length;
  return {
    userId,
    email,
    owned,
    leaving,
    learners: {
      children: learners.children,
      own: learners.own,
      profiles: learners.profiles,
    },
    answers: learners.answers,
    removed: owned
      .filter((place) => !place.demo)
      .map(({ id, name, kind }) => ({ id, name, kind })),
    left,
    secondParent,
    billingRecords,
    blockers,
  };
}

type Tally = Map<string, { ins: number; del: number; upd: number }>;
/** The row counters this backend holds for the current transaction. They
 * also carry an earlier transaction's counts until the backend reports them,
 * so a deletion reads them before and after and keeps the difference. */
async function tally(client: PoolClient): Promise<Tally> {
  const stats = await rows<{
    relname: string;
    ins: string;
    del: string;
    upd: string;
  }>(
    client,
    `SELECT relname,n_tup_ins AS ins,n_tup_del AS del,n_tup_upd AS upd
     FROM pg_stat_xact_user_tables WHERE schemaname=current_schema()`,
  );
  return new Map(
    stats.map((row) => [
      row.relname,
      { ins: Number(row.ins), del: Number(row.del), upd: Number(row.upd) },
    ]),
  );
}
/** Rows deleted and rows changed by this deletion, by table. */
function changes(before: Tally, after: Tally) {
  const counts: Record<string, { deleted: number; changed: number }> = {};
  for (const [table, end] of [...after].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const start = before.get(table) ?? { ins: 0, del: 0, upd: 0 };
    // Rows written on the way (a withdrawal marker, an audit row) and then
    // deleted are not the account's.
    const deleted = Math.max(0, end.del - start.del - (end.ins - start.ins));
    const changed = end.upd - start.upd;
    if (deleted || changed) counts[table] = { deleted, changed };
  }
  return counts;
}

async function inAccount<T>(
  pool: Pool,
  accountId: string,
  run: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout='5s'");
    await client.query("SET LOCAL statement_timeout='120s'");
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      accountId,
    ]);
    const result = await run(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/** What the confirm screen shows. */
export async function previewAccountDeletion(
  pool: Pool,
  accountId: string,
): Promise<DeletionPreview> {
  return inAccount(pool, accountId, async (client) => {
    const plan = await inspect(client, accountId);
    return {
      learners: plan.learners,
      answers: plan.answers,
      removed: plan.removed,
      left: plan.left,
      secondParent: plan.secondParent,
      billingRecords: plan.billingRecords,
      blockers: plan.blockers,
    };
  });
}

export type DeletionResult = {
  accountId: string;
  committed: boolean;
  removed: Place[];
  left: Place[];
  /** Rows deleted and rows changed, per table. */
  counts: Record<string, { deleted: number; changed: number }>;
};

class DryRun extends Error {
  constructor(readonly result: DeletionResult) {
    super("dry_run");
  }
}

/** Deletes the account and everything it owns, in one transaction. A dry run
 * does all of it, counts it, and rolls back. Refused while a blocker stands. */
export async function deleteAccount(
  pool: Pool,
  input: { accountId: string; via: "self" | "operator"; commit: boolean },
): Promise<DeletionResult> {
  const { accountId } = input;
  if (!accountId.trim() || accountId.startsWith("school:"))
    throw new AccountDeletionError(400, "account_invalid");
  try {
    return await inAccount(pool, accountId, async (client) => {
      const before = await tally(client);
      const plan = await inspect(client, accountId);
      if (plan.blockers.length)
        throw new AccountDeletionError(409, "deletion_blocked", plan.blockers);
      const schools = new SchoolRepository(pool);

      // 1. Places this person alone runs go whole: classes, rosters, the
      // family's second parent's place in it, licenses, history.
      for (const place of plan.owned)
        await removeOrgTree(client, {
          orgId: place.id,
          confirm: place.name,
          commit: true,
          allowLicensed: place.demo,
        });

      // 2. Shared places keep their records. This person's staff roles end as
      // an admin's "Remove" ends them, and their row there keeps no name,
      // address or link to the account.
      for (const { root, demo, people } of plan.leaving)
        for (const person of people) {
          // A visitor's roles in a shared demo school simply go: it has no
          // real admin to hand anything to.
          if (demo)
            for (const table of ["amp_org_roles", "amp_enrollments"])
              await client.query(`DELETE FROM ${table} WHERE person_id=$1`, [
                person,
              ]);
          const staff = await rows(
            client,
            `SELECT 1 FROM amp_org_roles r JOIN amp_orgs o ON o.id=r.org_id
             JOIN amp_people p ON p.id=r.person_id AND p.deleted_at IS NULL
             WHERE r.person_id=$1 AND r.role<>'student' AND ${activeToday("r", "o")} LIMIT 1`,
            [person],
          );
          if (staff.length) {
            // Institutional sharing belongs to the district, not to the adult
            // who connected it. Personal erasure leaves that institution intact.
            const institution =
              (
                await client.query(
                  "SELECT 1 FROM amp_clever_connections WHERE tenant_id=$1",
                  [root],
                )
              ).rowCount !== 0;
            await endStaffIn(client, schools, root, person, null, {
              allowLastAdmin: institution,
            });
          }
          await client.query(
            "UPDATE amp_families SET second_parent=NULL WHERE second_parent=$1",
            [person],
          );
          await client.query(
            `UPDATE amp_grants SET status='revoked' WHERE status='active' AND id IN
             (SELECT grant_id FROM amp_seats WHERE person_id=$1 AND grant_id IS NOT NULL)`,
            [person],
          );
          for (const table of [
            "amp_seats",
            "amp_person_credentials",
            "amp_student_sessions",
            "amp_demo_visitors",
          ])
            await client.query(`DELETE FROM ${table} WHERE person_id=$1`, [
              person,
            ]);
          await client.query(
            "DELETE FROM amp_scope_settings WHERE scope_kind='person' AND scope_id=$1",
            [person],
          );
          await client.query(
            `UPDATE amp_people SET account_id=NULL,email=NULL,given_name='Removed',
               family_name=NULL,display_name=NULL,deleted_at=COALESCE(deleted_at,now())
             WHERE id=$1`,
            [person],
          );
        }

      // 3. Every learner this account owns, with every learning record:
      // the deletion parents already use. A learner a payment names stays
      // only as a nameless "Deleted learner" reference for that record.
      await new FamilyRepository(pool).deleteLearningInside(client, accountId);

      // 4. Consent. Evidence of a consent that was given stays until its own
      // purge date (the withdrawal above set it). A withdrawal marker or a
      // request nobody completed is not evidence of anything.
      const evidence = !!(
        await rows(
          client,
          `SELECT 1 FROM amp_consent_requests WHERE account_id=$1 AND completed_at IS NOT NULL
           UNION ALL SELECT 1 FROM amp_purchase_consents WHERE account_id=$1 AND consent_at IS NOT NULL
           UNION ALL SELECT 1 FROM amp_parent_consents WHERE account_id=$1
             AND policy_version NOT IN ('withdrawn-without-record','consent-evidence-deleted')
           LIMIT 1`,
          [accountId],
        )
      ).length;
      await client.query(
        "DELETE FROM amp_consent_requests WHERE account_id=$1 AND completed_at IS NULL",
        [accountId],
      );
      if (!evidence)
        await client.query(
          "DELETE FROM amp_parent_consents WHERE account_id=$1",
          [accountId],
        );

      await rememberProviderPilotAliases(client, accountId);
      // Keep only the eligibility digest and dates needed to avoid reopening a
      // consumed pilot. Shared institutions keep anonymous authorization evidence.
      await client.query(
        "UPDATE amp_teacher_pilots SET account_id='deleted-pilot:'||id WHERE account_id=$1",
        [accountId],
      );
      await client.query(
        "UPDATE amp_class_authorizations SET account_id='removed',signer_name='Removed',signer_title='Removed' WHERE account_id=$1",
        [accountId],
      );
      for (const table of ["amp_school_starts", "amp_school_purchase_requests"])
        await client.query(`DELETE FROM ${table} WHERE account_id=$1`, [
          accountId,
        ]);
      // Independently deployable integrations may not yet be installed.
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_school_connection_requests') AS name",
          )
        ).rows[0].name
      ) {
        await client.query(
          "DELETE FROM amp_school_connection_requests WHERE account_id=$1",
          [accountId],
        );
        await client.query(
          "UPDATE amp_data_agreements SET signer_account_id=NULL,signer_name='Removed',signer_title='Removed' WHERE signer_account_id=$1",
          [accountId],
        );
      }
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_school_adoptions') AS name",
          )
        ).rows[0].name
      )
        await client.query(
          "DELETE FROM amp_school_adoptions WHERE source_account_id=$1 OR accepted_by_account_id=$1",
          [accountId],
        );

      // 5. Everything else keyed to the account.
      // School principals have no mailbox user to cascade from. The principal
      // owns identities and sessions; pending explicit-link proofs also go.
      if (
        (
          await client.query(
            "SELECT to_regclass('amp_provider_principals') AS relation",
          )
        ).rows[0].relation
      ) {
        await client.query(
          "DELETE FROM amp_provider_oauth_flows WHERE link_account_id=$1",
          [accountId],
        );
        await client.query(
          "DELETE FROM amp_provider_principals WHERE account_id=$1",
          [accountId],
        );
      }
      for (const sql of [
        "DELETE FROM amp_family_approvals WHERE account_id=$1",
        "DELETE FROM amp_demo_visitors WHERE account_id=$1",
        "DELETE FROM amp_export_tickets WHERE account_id=$1",
        "DELETE FROM amp_privacy_events WHERE account_id=$1",
        "DELETE FROM amp_journey_generations WHERE account_id=$1",
        "DELETE FROM amp_visitor_journeys WHERE account_id=$1",
        "DELETE FROM amp_ad_click_journeys WHERE account_id=$1",
        "DELETE FROM amp_ad_collection_withdrawals WHERE account_id=$1",
        "DELETE FROM amp_ad_order_attribution WHERE account_id=$1",
        "DELETE FROM amp_advertising_permissions WHERE account_id=$1",
        "DELETE FROM amp_meta_advertising_permissions WHERE account_id=$1",
        "DELETE FROM amp_openai_advertising_permissions WHERE account_id=$1",
        "DELETE FROM amp_meta_purchase_contexts WHERE account_id=$1",
        "DELETE FROM amp_google_purchase_queue WHERE account_id=$1",
        "DELETE FROM amp_meta_purchase_queue WHERE account_id=$1",
        "DELETE FROM amp_openai_purchase_queue WHERE account_id=$1",
        "DELETE FROM amp_trial_events WHERE trial_id IN (SELECT id FROM amp_trials WHERE owner_account_id=$1 OR adopted_by=$1)",
        "DELETE FROM amp_trials WHERE owner_account_id=$1 OR adopted_by=$1",
        // Someone else's records only mention who started or made them.
        "UPDATE amp_student_sessions SET started_by=NULL WHERE started_by=$1",
        "UPDATE amp_orgs SET created_by=NULL WHERE created_by=$1",
      ])
        await client.query(sql, [accountId]);
      await client.query(
        "DELETE FROM amp_access_gifts WHERE account_id=$1 OR ($2::text IS NOT NULL AND lower(recipient_email)=lower($2))",
        [accountId, plan.email],
      );

      // 6. The sign-in: sessions, passkeys, linked providers and sign-up
      // follow-ups go with the user by cascade.
      if (plan.userId) {
        await client.query(
          `DELETE FROM amp_auth_verifications WHERE value=$1
             OR lower(identifier)=lower($2)`,
          [plan.userId, plan.email],
        );
        await client.query("DELETE FROM amp_auth_users WHERE id=$1", [
          plan.userId,
        ]);
      }

      // Nothing live of the account is left.
      const left = (
        await rows<{ n: number }>(
          client,
          `SELECT ((SELECT count(*) FROM amp_learners WHERE account_id=$1 AND deleted_at IS NULL)
             + (SELECT count(*) FROM amp_people WHERE account_id=$1)
             + (SELECT count(*) FROM amp_families WHERE account_id=$1)
             + (SELECT count(*) FROM amp_auth_users WHERE 'amp|' || id=$1))::int AS n`,
          [accountId],
        )
      )[0]!.n;
      if (left) throw new AccountDeletionError(500, "deletion_incomplete");

      const result: DeletionResult = {
        accountId,
        committed: input.commit,
        removed: plan.removed,
        left: plan.left,
        counts: changes(before, await tally(client)),
      };
      if (!input.commit) throw new DryRun(result);
      await client.query(
        "INSERT INTO amp_account_deletions(id,account_id,via,counts) VALUES($1,$2,$3,$4)",
        [randomUUID(), accountId, input.via, JSON.stringify(result.counts)],
      );
      return result;
    });
  } catch (error) {
    if (error instanceof DryRun) return error.result;
    throw error;
  }
}
