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
  node --max-old-space-size=1408 --import tsx scripts/verify-clever-scale.ts --run --worker \
  --schools=100 --students-per-school=500 --classes-per-school=20
```

The focused tests cross batch boundaries, assert bounded query counts and stable learning row versions, and verify naming consent, roster authority and privacy races. They hold a practice transaction's learner row lock while an unchanged import completes, then verify that a name change waits for that lock. The scale driver generates synthetic paginated Clever responses, verifies transfers and access, records source and migration fingerprints, and removes only its own test schema. It never contacts Clever.

## Reference measurements

A November 13, 2026 local run used Node 22.23.4 and PostgreSQL 17.10 on macOS ARM64. The synthetic district contained 100 schools, 50,000 students, 2,000 teachers and 2,000 classes. The `--worker` mode runs the actual worker entrypoint, including its claim, due check, roster application and post-sync seat reconciliation. [The measurement receipt](reviews/school-onboarding/clever-worker-50000.json) records source hashes, runtime settings and identity/access assertions.

| Phase | SQL calls | Elapsed time |
| --- | ---: | ---: |
| First full import | 619 | 22.80 s |
| Repeated full import | 415 | 9.91 s |
| Transfer through three Events | 424 | 9.29 s |
| Empty Events poll | 29 | 0.023 s |
| Allocate 50,000 purchased seats | 162 | 3.38 s |
| Reconcile existing seats | 10 | 0.265 s |

The driver preserved person, learner and membership IDs on repeat import, retained learning evidence through a transfer, enforced staff scope and allocated each learner one seat. One hundred paid-access samples measured 5.56 ms at the 95th percentile; query plans used the seat and learner-grant indexes.

The Node process peaked at 598.42 MiB RSS with a 1,408 MiB JavaScript heap limit. Sampled peak heap usage was 441.85 MiB. This process includes synthetic provider responses, fixtures and instrumentation. It reuses one instrumented database connection for sequential worker transactions; it does not model external network latency, simultaneous districts, container CPU limits or PostgreSQL memory. These measurements are not production capacity guarantees. Measure the deployed worker and budget memory for concurrent jobs.

## Serving-process boundary

Full snapshots and nonempty Events reconciliation run in a separate worker pod. The API only queues imports and performs bounded adoption reads. Its administrator proof fetches one provider user. A stored school selector excludes users; a selected-school preview is limited to 5,000 source records. The worker also prepares paused connections for review without provisioning a roster.

A separate API-read driver stored a 50,000-student district in PostgreSQL, then performed 20 school-list and selected-school reads. Each selected school contained 500 students. Process RSS increased from 183.41 to a peak of 184.84 MiB. This isolates the bounded data-read path; it excludes the rest of the serving API's idle memory and PostgreSQL's memory.

```sh
AMP_TEST_DATABASE_URL=postgresql://localhost/amp_scratch_preview \
  node --import tsx scripts/verify-clever-api-memory.ts
```

The API-read driver leaves its synthetic schema for disposal with the scratch database. The worker CronJob template sets a separate 2 GiB memory limit. Size the worker and PostgreSQL lock budget against the largest expected district, including bulk changes.

## Bulk changes and PostgreSQL lock capacity

A district-wide grade promotion can change many existing learners in one transaction. Every changed learner account retains its advisory lock through commit. PostgreSQL advisory locks share the server's lock pool; capacity depends on server configuration and other active transactions. `max_locks_per_transaction` controls average shared lock capacity, not a per-transaction row limit, and changing it requires a server restart. See PostgreSQL's [lock configuration](https://www.postgresql.org/docs/16/runtime-config-locks.html) and [advisory-lock documentation](https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS).

Do not replace these transaction locks with an early-release scheme. Institution deletion acquires multiple account locks before row locks; releasing an account lock while retaining its person row can create a cycle with a later account acquisition. Preserve the shared privacy protocol when tuning import capacity.

The worker measurement used `max_connections=100` and `max_locks_per_transaction=64`. A separate importer-level PostgreSQL 16.14 test used `max_connections=100` and `max_locks_per_transaction=1024` for an atomic grade promotion of all 50,000 existing students. It completed in 7.00 seconds with 647 SQL calls, preserving person and learner identities, memberships and existing answer evidence. The driver's peak RSS was 1,293 MiB, including its fixtures and instrumentation. This importer-level measurement excludes worker scheduling and was tested for one bulk import at a time.

To include that workload, run the scale driver with `--mass-update` after configuring the dedicated test server:

```sh
AMP_TEST_DATABASE_URL=postgresql://localhost/amp_clever_fixture \
  node --import tsx scripts/verify-clever-scale.ts --run --mass-update \
  --schools=100 --students-per-school=500 --classes-per-school=20
```

Size and test lock capacity for the largest expected simultaneous bulk changes, other database writers and worker concurrency. Normal first imports, unchanged full scans and small transfers do not establish capacity for a mass update of existing learners. Inspect `pg_locks`, lock waits and database memory during the representative workload.
