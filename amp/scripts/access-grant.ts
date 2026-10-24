import { readFile } from "node:fs/promises";
import { z } from "zod";
import { createDatabasePool } from "../src/server/database.js";
import { AccessGiftRepository } from "../src/access-grants/repository.js";
import { AccessGiftError } from "../src/access-grants/contracts.js";

if (!process.env.AMP_DATABASE_URL || !process.argv[2])
  throw new Error(
    "Set AMP_DATABASE_URL and pass a private access-grant JSON file.",
  );
const pool = createDatabasePool({
  connectionString: process.env.AMP_DATABASE_URL,
});
try {
  const input = JSON.parse(await readFile(process.argv[2], "utf8"));
  const repository = new AccessGiftRepository(pool);
  const result =
    input.action === "revoke"
      ? await repository.revoke(
          z
            .strictObject({ action: z.literal("revoke"), id: z.uuid() })
            .parse(input).id,
        )
      : await repository.issue(input);
  // No recipient address or database details in terminal/CI output.
  console.log(JSON.stringify({ ...result, invitationPath: "/access" }));
} catch (error) {
  console.error(
    error instanceof AccessGiftError
      ? error.code
      : "Access grant failed. Check the private input and database configuration.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
