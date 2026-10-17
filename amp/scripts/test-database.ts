import { assertTestDatabaseTarget } from "./test-database-preflight.js";
import { migrate as applyMigrations } from "./migrate.js";

/** Fixture-only entrypoint. Import-time preflight also precedes caller setup. */
export async function migrate(connectionString: string): Promise<void> {
  if (typeof connectionString !== "string" || !connectionString.trim())
    throw new Error("An explicit fixture database URL is required");
  assertTestDatabaseTarget(connectionString);
  await applyMigrations(connectionString);
}
