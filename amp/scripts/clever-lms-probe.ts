import { pathToFileURL } from "node:url";
import { CleverClient } from "../src/schools/clever/client.js";
import { cleverId } from "../src/schools/clever/model.js";
import { LmsClient } from "../src/schools/clever/lms-client.js";
import {
  LmsError,
  lmsReady,
  type LmsType,
} from "../src/schools/clever/lms-model.js";
import {
  assignmentCreateBody,
  assignmentUpdateBody,
  planSubmission,
  submissionsOpen,
} from "../src/schools/clever/lms-payloads.js";
import { safeSyncError } from "../src/schools/clever/sync.js";

type Check = {
  status: "available" | "unavailable" | "skipped";
  [key: string]: unknown;
};
const failed = (error: unknown): Check => ({
  status: "unavailable",
  code: safeSyncError(error),
  ...(error instanceof LmsError && error.capability
    ? { capability: true }
    : {}),
});

/**
 * Verifies a sandbox district's LMS Connect capabilities. Output is status,
 * enum values and counts only: never IDs, tokens, names, titles or raw
 * provider errors.
 *
 *   npx tsx scripts/clever-lms-probe.ts            reads only
 *   npx tsx scripts/clever-lms-probe.ts --write    also creates, reads,
 *     updates and deletes one assignment in a synced section, and lists its
 *     submissions
 *   … --write --submission                         also grades one matched
 *     submission (1 point) before the assignment is deleted
 *
 * Writes run only against `AMP_CLEVER_ENVIRONMENT=sandbox`. The section is
 * `AMP_CLEVER_TEST_SECTION_ID`, or the first section Clever reports synced.
 */
export async function probeCleverLms(
  env: NodeJS.ProcessEnv,
  flags: { write?: boolean; submission?: boolean } = {},
  dependencies: { fetch?: typeof fetch; now?: () => Date } = {},
) {
  if (env.AMP_CLEVER_ENVIRONMENT !== "sandbox")
    throw new Error("sandbox_environment_required");
  if (flags.submission && !flags.write)
    throw new Error("submission_requires_write");
  const district = cleverId.parse(env.AMP_CLEVER_TEST_DISTRICT_ID);
  const chosen = env.AMP_CLEVER_TEST_SECTION_ID
    ? cleverId.parse(env.AMP_CLEVER_TEST_SECTION_ID)
    : null;
  const now = dependencies.now ?? (() => new Date());
  const clever = new CleverClient({
    clientId: env.AMP_CLEVER_CLIENT_ID ?? "",
    clientSecret: env.AMP_CLEVER_CLIENT_SECRET ?? "",
    apiVersion: "3.1",
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
  });
  const lms = new LmsClient({
    ...(dependencies.fetch ? { fetch: dependencies.fetch } : {}),
    budget: 200,
  });
  const checks: Record<string, Check> = {};
  let token: string;
  try {
    token = await clever.districtToken(district);
    checks.districtToken = { status: "available" };
  } catch (error) {
    checks.districtToken = failed(error);
    return checks;
  }

  let type: LmsType | null = null;
  let ready = false;
  try {
    const row = await lms.district(token, district);
    type = row.lms_type;
    ready = lmsReady(row);
    checks.district = {
      status: "available",
      lmsState: row.lms_state,
      lmsType: row.lms_type,
      lastLmsSync: row.last_lms_sync ? "present" : "absent",
    };
  } catch (error) {
    checks.district = failed(error);
  }

  let section: { id: string; term: string | null } | null = null;
  try {
    const rows = await lms.sections(token);
    const synced = rows.filter((row) => row.synced);
    const pick = chosen ? rows.find((row) => row.id === chosen) : synced[0];
    section = pick ? { id: pick.id, term: pick.term_id ?? null } : null;
    checks.sections = {
      status: "available",
      count: rows.length,
      synced: synced.length,
      ...(chosen ? { chosenSynced: pick?.synced === true } : {}),
    };
  } catch (error) {
    checks.sections = failed(error);
  }
  if (!flags.write) return checks;

  if (!ready || !type || !section) {
    checks.assignment = {
      status: "skipped",
      reason: !ready
        ? "lms_not_ready"
        : !type
          ? "lms_type_unknown"
          : "no_synced_section",
    };
    return checks;
  }
  const draft = {
    title: "AMP LMS Connect probe",
    description: "Created and deleted by AMP's LMS Connect probe.",
    dueAt: new Date(now().getTime() + 7 * 86_400_000),
    pointsPossible: 10,
    link: "https://amp.corpora.inc/",
    termId: section.term,
  };
  let id: string;
  try {
    const created = await lms.createAssignment(
      token,
      section.id,
      assignmentCreateBody(type, draft, now()),
    );
    id = created.id;
    checks.assignmentCreate = {
      status: "available",
      state: created.state ?? null,
    };
  } catch (error) {
    checks.assignmentCreate = failed(error);
    return checks;
  }
  try {
    try {
      const read = await lms.getAssignment(token, section.id, id);
      checks.assignmentRead = {
        status: "available",
        state: read.state ?? null,
      };
      const updated = await lms.updateAssignment(
        token,
        section.id,
        id,
        assignmentUpdateBody(type, { ...draft, pointsPossible: 5 }, now()),
      );
      checks.assignmentUpdate = {
        status: "available",
        pointsApplied: updated.points_possible === 5,
      };
      if (!submissionsOpen(type, read.state)) {
        checks.submissions = {
          status: "skipped",
          reason: "assignment_not_open",
        };
      } else {
        const rows = await lms.submissions(token, section.id, id);
        const states: Record<string, number> = {};
        for (const row of rows) {
          const state = row.state ?? "none";
          states[state] = (states[state] ?? 0) + 1;
        }
        checks.submissions = {
          status: "available",
          count: rows.length,
          unmatched: rows.filter((row) => !row.user_id).length,
          states,
        };
        if (flags.submission) {
          const target = rows.find((row) => row.user_id);
          if (!target) {
            checks.submissionUpdate = {
              status: "skipped",
              reason: "no_matched_student",
            };
          } else {
            const plan = planSubmission(
              type,
              {
                state: target.state ?? null,
                points: target.grade_points ?? null,
              },
              { points: 1, final: true },
              null,
            );
            let last = null;
            for (const body of plan.kind === "write" ? plan.bodies : [])
              last = await lms.updateSubmission(
                token,
                section.id,
                id,
                target.user_id!,
                body,
              );
            checks.submissionUpdate = {
              status: "available",
              writes: plan.kind === "write" ? plan.bodies.length : 0,
              state: last?.state ?? null,
              graded: last?.grade_points === 1,
            };
          }
        }
      }
    } catch (error) {
      checks.failedStep = failed(error);
    }
  } finally {
    try {
      checks.assignmentDelete = {
        status: "available",
        result: await lms.deleteAssignment(token, section.id, id),
      };
      await lms.getAssignment(token, section.id, id).then(
        () =>
          (checks.deletedRead = {
            status: "unavailable",
            code: "still_present",
          }),
        (error) =>
          (checks.deletedRead =
            error instanceof LmsError &&
            error.lmsCode === "lms_assignment_missing"
              ? { status: "available", result: "missing" }
              : failed(error)),
      );
    } catch (error) {
      checks.assignmentDelete = failed(error);
    }
  }
  return checks;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter(
    (arg) => !["--write", "--submission"].includes(arg),
  );
  if (unknown.length) {
    console.error("Usage: clever-lms-probe.ts [--write [--submission]]");
    process.exitCode = 2;
  } else {
    try {
      const result = await probeCleverLms(process.env, {
        write: args.has("--write"),
        submission: args.has("--submission"),
      });
      console.log(JSON.stringify(result));
      if (Object.values(result).some((check) => check.status === "unavailable"))
        process.exitCode = 1;
    } catch (error) {
      // Only this script's own fixed codes, never a provider message.
      const own =
        error instanceof Error &&
        ["sandbox_environment_required", "submission_requires_write"].includes(
          error.message,
        );
      console.error(
        JSON.stringify({ error: own ? error.message : safeSyncError(error) }),
      );
      process.exitCode = 1;
    }
  }
}
