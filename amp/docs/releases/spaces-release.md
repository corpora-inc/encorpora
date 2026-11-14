# Spaces release

The spaces redesign (Family, Classroom and School, Me, Pathways) lands on `main`
as one merge and reaches production in one deploy. This page is the operator's
checklist for that deploy. The schema and rollout rules behind it are in
[the family API architecture](../architecture/family-api.md#first-course-placement-and-deployment).

## 1. Migrations

The deploy runs `npm run db:migrate` before the new API serves, as every deploy
does ([deployment](../deployment.md)). It applies, in this order:

| File | What it does | Lock profile |
|---|---|---|
| `0126-family-spaces.sql` | Family identity (`amp_family_spaces`) and account names (`amp_account_profiles`); erase hook on account deletion; legacy class creation publishes an identity | New tables, one copy from `amp_families` |
| `0127-course-start.sql` | `amp_learners.starting_course_level` (nullable, no default) and the `amp_course_placement` flag, off | Metadata only, no rewrite, no backfill |
| `0128-family-history-indexes.sql` | Four history indexes | `CREATE INDEX CONCURRENTLY`, writes continue |
| `0129-family-display-name.sql` | `amp_family_spaces.display_name` (nullable) | Metadata only |
| `0130-family-identity-fallback.sql` | Deterministic family identity function and hooks | Functions and triggers |
| `0131-family-discovery-index.sql` | Class-to-family lookup index | `CREATE INDEX CONCURRENTLY` |
| `0132-funded-term-schedule.sql` | `amp_funding_requests.scheduled_term` (nullable) | Metadata only |
| `0133-level-practice.sql` | `amp_learners.level_practice` and its one-per-account index | Metadata, one index build |

They follow main's highest number (`0125`). Production has applied none of
them, so production needs no renaming. The order does not matter relative to
main's two `0125` migrations: a schema-only dump of a database migrated in the
old order (family spaces between them) is identical to one migrated in this
order. `tests/migration-names.test.ts` fails if a new migration reuses a number.

Funded activation (`src/funding-purchase/provision.ts`, used by the API and
the funding workers) writes and reads `scheduled_term`. Both run from the image
deployed after the migration job, so no extra ordering step is needed. Never
start a worker from this release against a database that has not run `0132`.

### Development and preview databases

These migrations were numbered `0125`-`0132` while the branch was built. A
database that applied the earlier names needs no action: the runner adopts each
receipt under its new name when the file is unchanged
(`renamedMigrations` in `scripts/migrate.ts`). To rename the rows by hand
instead, with the API stopped:

```sql
BEGIN;
UPDATE amp_migrations SET name = v.new FROM (VALUES
  ('0125-family-spaces.sql',          '0126-family-spaces.sql'),
  ('0126-course-start.sql',           '0127-course-start.sql'),
  ('0127-family-history-indexes.sql', '0128-family-history-indexes.sql'),
  ('0128-family-display-name.sql',    '0129-family-display-name.sql'),
  ('0129-family-identity-fallback.sql','0130-family-identity-fallback.sql'),
  ('0130-family-discovery-index.sql', '0131-family-discovery-index.sql'),
  ('0131-funded-term-schedule.sql',   '0132-funded-term-schedule.sql'),
  ('0132-level-practice.sql',         '0133-level-practice.sql')
) AS v(old, new) WHERE amp_migrations.name = v.old;
COMMIT;
```

The checksums do not change: only the file names did.

## 2. Backfill (automatic)

After the schema transactions commit, the runner fills family identities for
existing accounts in bounded batches and records `data:family-identities-v1` in
`amp_migrations`. No operator step. A failure leaves the receipt absent and the
next run resumes. Check it:

```sql
SELECT name FROM amp_migrations WHERE name = 'data:family-identities-v1';
```

## 3. Course placement flag (after the deploy)

`amp_course_placement.enabled` ships off. Turn it on only when every API replica
and worker runs this release (the rollout has finished and no older pod
serves):

```sql
UPDATE amp_course_placement SET enabled = true;
```

Once it is on, a full rollback to a pre-spaces image is unsafe. The safe
rollback is to set it back to `false` and stay on an image that reads
`starting_course_level` (see the architecture page).

## 4. Funding offers

The private offers file (`AMP_FUNDING_OFFERS_FILE`) is already at revision v4
with the current list price. Nothing to change for this release.

## 5. Smoke checks after the deploy

1. `GET /api/v1/health` reports the merged commit.
2. `SELECT name FROM amp_migrations WHERE name >= '0126' ORDER BY name;` lists
   `0126`-`0133` and `data:family-identities-v1`.
3. A brand-new account opens `/start` on "What brings you to AMP?".
4. An existing parent opens `/` on Family and sees each child, with a week of
   Time or the empty state for a child with no practice.
5. A teacher at a licensed school opens their class's Today; a school admin
   opens the school.
6. An adult opens Me and starts practice; "Practice at a level" opens a problem.
7. Pathways opens for a child and for the adult's own practice.
8. A parent of a child without access reaches checkout from the purchase page
   (Stripe test mode is never used in production: stop at the checkout page).
9. After step 3 of this page, a new child without a birth year in a class with a
   grade band starts at that band's level.
