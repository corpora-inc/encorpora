# Clever roster performance and privacy

AMP applies each validated Clever roster in one transaction per connection. A failed import leaves its roster and event cursor unchanged. Student records, learning evidence and class history retain their identities across transfers and sharing changes.

Database reads and writes use batches of at most 1,000 rows. Schools, courses, terms, classes, people, learners, source bindings and memberships share this approach. Membership planning preserves manual grants and assigns source ownership only to rows created by Clever or explicitly adopted into its maintenance.

An unchanged person or learner requires no row or account advisory lock. Unchanged source bindings receive only a checkpoint update; their personal payload and archive status are untouched. This prevents a concurrent privacy deletion from having its scrubbed source record restored. New people are invisible outside the import transaction and need no account advisory locks before commit.

Changed personal data and newly created memberships retain the privacy protocol: account advisory locks in sorted order, then person and learner row locks. Naming an unnamed learner uses the shared consent checks before identifying roster fields are written. A grade change adjusts the starting prior only while the learner has no answer evidence and no numbered identity. Classroom display names are preserved.

## Verification

From `amp/`, use a dedicated local test database with permission to create and drop schemas:

```sh
AMP_TEST_DATABASE_URL=postgresql://localhost/amp_clever_fixture \
  node --import tsx --test tests/clever-batch.integration.ts

AMP_TEST_DATABASE_URL=postgresql://localhost/amp_clever_fixture \
  node --import tsx scripts/verify-clever-scale.ts --run \
  --schools=100 --students-per-school=500 --classes-per-school=20
```

The focused tests cross batch boundaries, assert bounded query counts and stable learning row versions, and verify naming consent, roster authority and privacy races. They hold a practice transaction's learner row lock while an unchanged import completes, then verify that a name change waits for that lock. The scale driver generates synthetic paginated Clever responses, verifies transfers and access, records source and migration fingerprints, and removes only its own test schema. It never contacts Clever.

## Reference measurements

One local run used Node 22.23.4 and PostgreSQL 16.14 on macOS ARM64, with one district synchronizing at a time. Both fixtures had 100 schools and approximately 25 students per class. These are measurements of synthetic workloads, not production capacity guarantees.

| Students | Phase | SQL calls | Elapsed time |
| ---: | --- | ---: | ---: |
| 10,000 | First full import | 146 | 2.03 s |
| 10,000 | Repeated full import | 94 | 0.94 s |
| 10,000 | Transfer through three Events | 103 | 1.00 s |
| 50,000 | First full import | 604 | 11.25 s |
| 50,000 | Repeated full import | 347 | 5.30 s |
| 50,000 | Transfer through three Events | 356 | 5.29 s |
| 50,000 | Allocate purchased seats | 162 | 2.18 s |
| 50,000 | Reconcile existing seats | 10 | 0.22 s |

An empty Events poll used 14 SQL calls. The 50,000-student fixture included 2,000 teachers and 2,000 classes. Its Node process peaked at 917 MiB RSS, including the synthetic provider, complete fixtures and instrumentation. Measure the deployed worker separately and budget memory for concurrent jobs.

## Serving-process boundary

Full snapshots and nonempty Events reconciliation run in a separate worker pod. The API only queues imports and performs bounded adoption reads. Its administrator proof fetches one provider user. A stored school selector excludes users; a selected-school preview is limited to 5,000 source records. The worker also prepares paused connections for review without provisioning a roster.

A local Node 22.23.4/PostgreSQL 17.10 ARM64 run with 20,000 students, 40 schools and 800 classes measured 484 MiB maximum RSS for the synthetic worker driver. First import took 7.19 seconds, repeat import 3.11 seconds, and an Events transfer 3.12 seconds. This process includes synthetic provider responses and instrumentation; it is not the serving API and does not establish a production memory limit.

The API-read driver generated a 50,000-student district in PostgreSQL, then performed 20 school-list and selected-school reads. Each selected school contained 500 students. Maximum process RSS was 187 MiB, with RSS increasing from 185 to 187 MiB across the reads. This isolates the data-read path; it excludes the rest of the serving API's idle memory and PostgreSQL's memory.

```sh
AMP_TEST_DATABASE_URL=postgresql://localhost/amp_scratch_preview \
  node --import tsx scripts/verify-clever-api-memory.ts
```

The API-read driver leaves its synthetic schema for disposal with the scratch database. The worker CronJob template sets a separate 2 GiB memory limit. Size the worker and PostgreSQL lock budget against the largest expected district, including bulk changes.

## Bulk changes and PostgreSQL lock capacity

A district-wide grade promotion can change many existing learners in one transaction. Every changed learner account retains its advisory lock through commit. PostgreSQL advisory locks share the server's lock pool; capacity depends on server configuration and other active transactions. `max_locks_per_transaction` controls average shared lock capacity, not a per-transaction row limit, and changing it requires a server restart. See PostgreSQL's [lock configuration](https://www.postgresql.org/docs/16/runtime-config-locks.html) and [advisory-lock documentation](https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS).

Do not replace these transaction locks with an early-release scheme. Institution deletion acquires multiple account locks before row locks; releasing an account lock while retaining its person row can create a cycle with a later account acquisition. Preserve the shared privacy protocol when tuning import capacity.

The normal fixtures used `max_connections=100` and `max_locks_per_transaction=64`. A separate PostgreSQL 16.14 test used `max_connections=100` and `max_locks_per_transaction=1024` for an atomic grade promotion of all 50,000 existing students. It completed in 7.00 seconds with 647 SQL calls, preserving person and learner identities, memberships and existing answer evidence. The driver's peak RSS was 1,293 MiB, including its fixtures and instrumentation. This configuration was tested for one bulk import at a time.

To include that workload, run the scale driver with `--mass-update` after configuring the dedicated test server:

```sh
AMP_TEST_DATABASE_URL=postgresql://localhost/amp_clever_fixture \
  node --import tsx scripts/verify-clever-scale.ts --run --mass-update \
  --schools=100 --students-per-school=500 --classes-per-school=20
```

Size and test lock capacity for the largest expected simultaneous bulk changes, other database writers and worker concurrency. Normal first imports, unchanged full scans and small transfers do not establish capacity for a mass update of existing learners. Inspect `pg_locks`, lock waits and database memory during the representative workload.
