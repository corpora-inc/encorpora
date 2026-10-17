# Test database safety

Database integration tests and browser proofs migrate their target and write
synthetic fixtures. Give `AMP_TEST_DATABASE_URL` a dedicated disposable database,
such as `amp_test`; concurrent workers should use separate databases. The `/amp`
local preview is preserved application data and is not a fixture target.

`scripts/test-database-preflight.ts` rejects the known shared preview name,
including its URL-encoded form, before fixture setup. Direct database fixtures
import that preflight. Fixtures that invoke migrations import `migrate` from
`scripts/test-database.ts`; it also validates the explicit connection argument
before opening a connection. Isolated-schema options are supported inside a
dedicated database. A separate schema does not exempt a shared preview target.

The guard rejects known unsafe or ambiguous targets; it cannot identify every
production database from its name. Operators must still provision an empty,
dedicated fixture database. It does not create, delete, or reset databases.
Deployment `scripts/migrate.ts` and `npm run db:migrate` keep their existing
behavior and do not import the test guard.

The regression suite executes database-backed verifier and integration entrypoints
as subprocesses with an encoded preview name on an unused local port. Every
entrypoint must reject it at preflight. The unused port prevents accidental
preview access even if a future change removes a guard. New database-backed
fixtures should use `AMP_TEST_DATABASE_URL` and the same guarded imports.
