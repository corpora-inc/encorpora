import { createDatabasePool } from "../src/server/database.js";
import { runPipelineCommand } from "../src/acquisition/pipeline.js";
import { acquisitionPipelineReport } from "../src/acquisition/report.js";

const action = process.argv[2];
if (!["report", "apply"].includes(action) || process.argv.length !== 3)
  throw new Error(
    "Usage: acquisition:pipeline report | apply < private-command.json",
  );
if (!process.env.AMP_DATABASE_URL)
  throw new Error("AMP_DATABASE_URL is required");
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  if (action === "report")
    console.log(JSON.stringify(await acquisitionPipelineReport(pool), null, 2));
  else {
    let data = "";
    for await (const chunk of process.stdin) {
      data += chunk.toString();
      if (Buffer.byteLength(data) > 250_000)
        throw new Error("Command is too large");
    }
    console.log(
      JSON.stringify(await runPipelineCommand(pool, JSON.parse(data)), null, 2),
    );
  }
} catch (error) {
  // Do not leak PostgreSQL constraint detail, mail bodies or command input to logs.
  console.error(
    error instanceof Error && !("code" in error)
      ? error.message
      : "Pipeline database operation failed",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
