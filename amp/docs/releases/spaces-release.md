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
| `0127-family-spaces.sql` | Family identity (`amp_family_spaces`) and account names (`amp_account_profiles`); erase hook on account deletion; legacy class creation publishes an identity | New tables, one copy from `amp_families` |
| `0128-course-start.sql` | `amp_learners.starting_course_level` (nullable, no default) and the `amp_course_placement` flag, off | Metadata only, no rewrite, no backfill |
| `0129-family-history-indexes.sql` | Four history indexes | `CREATE INDEX CONCURRENTLY`, writes continue |
| `0130-family-display-name.sql` | `amp_family_spaces.display_name` (nullable) | Metadata only |
| `0131-family-identity-fallback.sql` | Deterministic family identity function and hooks | Functions and triggers |
| `0132-family-discovery-index.sql` | Class-to-family lookup index | `CREATE INDEX CONCURRENTLY` |
| `0133-funded-term-schedule.sql` | `amp_funding_requests.scheduled_term` (nullable) | Metadata only |
| `0134-level-practice.sql` | `amp_learners.level_practice` and its one-per-account index | Metadata, one index build |

They follow main's highest number (`0126-consent-single-response`, #2333).
Production has applied none of them, so production needs no renaming. They do
not depend on their order relative to main's `0125` and `0126` migrations:
main's touch funnel events, funded invoices and consent requests, none of the
spaces tables or columns, and a schema-only dump of a database migrated with
the spaces files before main's `0125-funded-pending-invoices` is identical to
one migrated in this order. `tests/migration-names.test.ts` fails if a new
migration reuses a number.

Funded activation (`src/funding-purchase/provision.ts`, used by the API and
the funding workers) writes and reads `scheduled_term`. Both run from the image
deployed after the migration job, so no extra ordering step is needed. Never
start a worker from this release against a database that has not run `0133`.

### Development and preview databases

These migrations were numbered `0125`-`0132`, then `0126`-`0133`, while the
branch was built. A database that applied either set of names needs no action:
the runner adopts each receipt under its new name when the file is unchanged
(`renamedMigrations` in `scripts/migrate.ts`). To rename the rows by hand
instead, with the API stopped:

```sql
BEGIN;
UPDATE amp_migrations SET name = v.new FROM (VALUES
  ('0126-family-spaces.sql',          '0127-family-spaces.sql'),
  ('0127-course-start.sql',           '0128-course-start.sql'),
  ('0128-family-history-indexes.sql', '0129-family-history-indexes.sql'),
  ('0129-family-display-name.sql',    '0130-family-display-name.sql'),
  ('0130-family-identity-fallback.sql','0131-family-identity-fallback.sql'),
  ('0131-family-discovery-index.sql', '0132-family-discovery-index.sql'),
  ('0132-funded-term-schedule.sql',   '0133-funded-term-schedule.sql'),
  ('0133-level-practice.sql',         '0134-level-practice.sql')
) AS v(old, new) WHERE amp_migrations.name = v.old;
COMMIT;
```

(A database still on the first names, `0125-family-spaces.sql` and so on,
shifts each by two the same way.) The checksums do not change: only the file
names did. Main's `0126-consent-single-response.sql` then applies on the next
migrate as a new migration.

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
   `0126-consent-single-response`, `0127`-`0134` and `data:family-identities-v1`.
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

## 6. If something is wrong: fail forward

Production is the trunk ([deployment](../deployment.md)). A deploy that fails
its own smoke checks is rolled back automatically by the deploy workflow and
held until a newer green commit arrives. Anything found after a healthy deploy
is fixed by another small PR to `main` through the same gates, not by
reverting the merge:

- The migrations only add tables, nullable columns, indexes, functions and
  triggers; the previous image runs against the new schema. Never edit or
  remove an applied migration.
- Before step 3 (the course placement flag), redeploying the previous image is
  safe. After it, set `amp_course_placement.enabled` back to `false` and stay
  on an image that reads `starting_course_level` (step 3).
- The family identity backfill writes only new identity rows; it never rewrites
  a published id, so it needs no undo.

## Next (deferred: not correctness, security, data or visible breakage)

- Responsive round's open items (reports/spaces/responsive/ledger.md, "Next"):
  the work replay's feedback panel clips rather than scrolls at 600 px; replay
  feedback steps scroll inside their panel at 320–768 px; the school Students
  grid and a class's workbook set grid scroll inside the page at 768 px;
  workbook row titles and standings figure tips are short hit targets at
  768 px and up; the practice stage scrolls between its toolbar and dock on
  phones; math in prompts can break at an operator at 320 px; the 769–1000 px
  Pathways browser is an overlay with its own scroll.
- A stored level is saved when a batch is planned, so stored-level readers
  (`/me/practice`, records, maps) say "not measured" until the batch after a
  learner's first answer (older than spaces; CP-5 makes it visible).
- At 844x390 phone landscape, Billing's "Purchases and records" row sits below
  a page that cannot scroll (landscape phones are a smoke check only).
- A class's term report cards ("Print all") are offered before anyone in it is
  measured (the per-learner progress report now waits).
- The entry chunk is 16 KB gzip larger than main's (the shell's space
  resolver, which frames every screen).
- `renamedMigrations` in `scripts/migrate.ts` can go once no development or
  preview database still holds the earlier spaces migration names.
- A second parent's bar on a family child's workbooks shows the family's
  org name rather than "<holder>'s family".
- From the classroom round: an empty roster misses the class's own future
  pilot start in the recheck; a pre-existing lockout code mismatch.
