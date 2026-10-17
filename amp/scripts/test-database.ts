import { assertTestDatabaseTarget } from "./test-database-preflight.js";
import { migrate as applyMigrations } from "./migrate.js";

/** Fixture-only entrypoint. Import-time preflight also precedes caller setup. */
export async function migrate(connectionString: string): Promise<void> {
  assertTestDatabaseTarget(connectionString);
  await applyMigrations(connectionString);
}
