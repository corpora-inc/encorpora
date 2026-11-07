import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { createDatabasePool } from "../src/server/database.js";
import {
  issueStudentSessionSchema,
  SchoolError,
} from "../src/schools/contracts.js";
import { SchoolRepository } from "../src/schools/repository.js";

/** Operating AMP for Schools, for privileged agents: there is no admin UI.
 *
 *   npm run school:admin -- <command> <private-input.json>
 *
 * Input stays in a private file, so student names never reach a shell history
 * or CI log. Output is one JSON line of identifiers and counts; only
 * `issue-student-session` prints a secret, its token.
 *
 * create-org             {kind, name, timezone?, parentId?, agreement?: {version, signerName, signerTitle}}
 * add-staff              {orgId, role, givenName, familyName?, email?, accountId?, classId?}
 * issue-license          {orgId, seats, endsAt, startsAt?, reference?}
 * set-seats              {licenseId, seats}
 * extend-license         {licenseId, endsAt}
 * add-student            {orgId, givenName, familyName?, displayName?, email?, identifier?, gradeLevel?, classId?}
 * issue-student-session  {personId, mode: "shared" | "personal"}
 */
export async function schoolAdmin(
  repository: SchoolRepository,
  command: string,
  input: unknown,
): Promise<unknown> {
  switch (command) {
    case "create-org": {
      const { agreement, ...org } = z
        .looseObject({ agreement: z.unknown().optional() })
        .parse(input);
      const created = await repository.createOrg(org, agreement);
      return { ...created, agreement: agreement !== undefined };
    }
    case "add-staff":
      return repository.addStaff(input);
    case "issue-license":
      return repository.issueLicense(input);
    case "set-seats":
      return repository.setSeats(input);
    case "extend-license":
      return repository.extendLicense(input);
    case "add-student": {
      const { orgId, ...student } = z
        .looseObject({ orgId: z.uuid() })
        .parse(input);
      return repository.provisionStudent(orgId, student);
    }
    case "issue-student-session":
      return repository.issueStudentSession(
        issueStudentSessionSchema.parse(input),
      );
    default:
      throw new SchoolError(400, "unknown_command");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const [command, file] = process.argv.slice(2);
  if (!process.env.AMP_DATABASE_URL || !command || !file)
    throw new Error(
      "Set AMP_DATABASE_URL and pass a command and a private JSON file.",
    );
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    const input = JSON.parse(await readFile(file, "utf8"));
    console.log(
      JSON.stringify(
        await schoolAdmin(new SchoolRepository(pool), command, input),
      ),
    );
  } catch (error) {
    // Codes only: a validation or database message could quote the input.
    console.error(
      JSON.stringify({
        error:
          error instanceof SchoolError
            ? error.code
            : error instanceof z.ZodError
              ? "invalid_input"
              : "school_admin_failed",
      }),
    );
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
