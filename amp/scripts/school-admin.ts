import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { createDatabasePool } from "../src/server/database.js";
import {
  issueStudentSessionSchema,
  SchoolError,
} from "../src/schools/contracts.js";
import {
  createSchool,
  mailSetupInvitation,
} from "../src/schools/onboarding.js";
import { SchoolRepository } from "../src/schools/repository.js";
import type { SchoolServices } from "../src/schools/routes.js";
import { deleteOrg } from "./school-delete-org.js";
import { accountMail, accountsConfiguration } from "../src/server/accounts.js";

/** Operating AMP for Schools, for privileged agents: there is no admin UI.
 *
 *   npm run school:admin -- <command> <private-input.json>
 *
 * Input stays in a private file, so student names never reach a shell history
 * or CI log. Output is one JSON line of identifiers and counts; only
 * `create-school` and `issue-student-session` print a secret: the admin's setup
 * link and the student's token.
 *
 * create-school          {name, adminEmail, seats, startsOn, endsOn, reference, timezone?}
 *     A new school, after a contract and invoice or PO; a free pilot is given on
 *     purpose with reference "Pilot". Dates are days in the school's zone
 *     (default America/New_York), through `endsOn`. Makes the org, the license
 *     and the admin's setup invitation in one transaction, mails the link and
 *     prints it. The same name and admin again, while setup is pending, sends the
 *     same invitation and creates nothing. Needs the server's AMP_ACCOUNTS_URL
 *     and AMP_ACCOUNTS_SECRET, and its mail settings to send.
 * create-org             {kind, name, timezone?, parentId?, agreement?: {version, signerName, signerTitle}}
 * add-staff              {orgId, role, givenName, familyName?, email?, accountId?, classId?}
 * issue-license          {orgId, seats, endsAt, startsAt?, reference?}
 * set-seats              {licenseId, seats}
 * extend-license         {licenseId, endsAt}
 * add-student            {orgId, givenName, familyName?, displayName?, email?, identifier?, gradeLevel?, classId?}
 * issue-student-session  {personId, mode: "shared" | "personal"}
 * delete-org             {orgId, confirm, commit?: false, allowLicensed?: false}
 *     Removes a school, district or family org entirely: its tree, people,
 *     classes, seats, licenses, credentials, grades, settings and events, and
 *     the learners that school accounts own. A learner owned by a parent or an
 *     adult account is only detached. A dry run (the default) prints what a
 *     commit would remove and changes nothing. `confirm` is the org's exact
 *     name; a child org is refused (delete its root); a paid license in force
 *     is refused unless `allowLicensed`.
 */
export async function schoolAdmin(
  repository: SchoolRepository,
  command: string,
  input: unknown,
  /** Invitation keys and the account mail path, for `create-school`. */
  services?: Pick<SchoolServices, "secret" | "origin" | "mail">,
): Promise<unknown> {
  switch (command) {
    case "create-school": {
      if (!services) throw new SchoolError(503, "accounts_unconfigured");
      const school = await createSchool(repository, services, input);
      return {
        orgId: school.orgId,
        licenseId: school.licenseId,
        adminPersonId: school.adminPersonId,
        created: school.created,
        mailed: await mailSetupInvitation(services, school),
        setupUrl: school.setupUrl,
      };
    }
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
    case "delete-org":
      return deleteOrg(repository, input);
    default:
      throw new SchoolError(400, "unknown_command");
  }
}

/** The server's own keys and mail, so the link it prints is the one the server
 * reads and the admin's copy link on the staff screen stays the same. */
function servicesFromEnv(): Pick<SchoolServices, "secret" | "origin" | "mail"> {
  let config;
  try {
    config = accountsConfiguration(process.env);
  } catch {
    throw new SchoolError(503, "accounts_unconfigured");
  }
  return {
    secret: config.secret,
    origin: config.baseURL,
    mail: accountMail(config),
  };
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
        await schoolAdmin(
          new SchoolRepository(pool),
          command,
          input,
          command === "create-school" ? servicesFromEnv() : undefined,
        ),
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
