/** Integration tests may migrate their target; the shared preview is never a fixture. */
export function assertTestDatabaseTarget(value: string | undefined): void {
  if (!value) return; // Integration suites explicitly skip without a test database.
  let target: URL;
  try {
    target = new URL(value);
  } catch {
    throw new Error("AMP_TEST_DATABASE_URL must be an explicit PostgreSQL URL");
  }
  const database = decodeURIComponent(target.pathname.slice(1));
  if (
    !["postgres:", "postgresql:"].includes(target.protocol) ||
    !database ||
    database.includes("/") ||
    target.searchParams.has("dbname") ||
    target.searchParams.has("database")
  ) {
    throw new Error(
      "AMP_TEST_DATABASE_URL must name one explicit fixture database",
    );
  }
  if (database === "amp") {
    throw new Error(
      "Integration tests cannot target the shared /amp preview. Use a dedicated fixture database, such as amp_paid_evidence_1031.",
    );
  }
}

assertTestDatabaseTarget(process.env.AMP_TEST_DATABASE_URL);
