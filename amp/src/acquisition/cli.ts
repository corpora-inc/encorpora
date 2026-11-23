/** The acquisition pipeline's operator command: `report`, `apply` and
 * `apply-batch`, with private JSON on stdin and stdout.
 *
 * The server build bundles this file to `src/acquisition/cli.mjs`
 * (`scripts/build-server.ts`), so production runs it on plain node:
 *
 *   node src/acquisition/cli.mjs apply-batch < /private/commands.json
 *
 * An API pod is close to its memory limit while it serves, and a process
 * started in it shares that limit. Compiling TypeScript there (tsx under npm)
 * costs well over 100 MiB a run; the bundle costs about what node itself does.
 * A batch is one process and one connection for any number of commands. */
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { createDatabasePool } from "../server/database.js";
import { runPipelineCommand } from "./pipeline.js";
import { acquisitionPipelineReport } from "./report.js";

export const USAGE =
  "Usage: acquisition pipeline report | apply < private-command.json | apply-batch < private-commands.json";
const ACTIONS = ["report", "apply", "apply-batch"] as const;
type Action = (typeof ACTIONS)[number];
/** One command stays small; a batch holds a whole mailing. */
const LIMIT: Record<Exclude<Action, "report">, number> = {
  apply: 250_000,
  "apply-batch": 4_000_000,
};
export const BATCH_MAX = 5000;

/** Never PostgreSQL constraint detail, mail bodies or command input. */
export const safeMessage = (error: unknown) =>
  error instanceof Error && !("code" in error)
    ? error.message
    : "Pipeline database operation failed";

export type BatchResult = {
  applied: number;
  replayed: number;
  failed: number;
  /** Counts by action, with `record-event` split by kind. */
  tally: Record<string, number>;
  /** Where each failure is in the input, and why. No addresses. */
  errors: { index: number; action: string; message: string }[];
};

const label = (command: unknown) => {
  if (!command || typeof command !== "object") return "unknown";
  const { action, kind } = command as { action?: unknown; kind?: unknown };
  if (typeof action !== "string") return "unknown";
  return typeof kind === "string" ? `${action}:${kind}` : action;
};

/**
 * Applies commands in order, each in its own transaction. A failed command is
 * reported and the rest still run: every command is idempotent under its event
 * key, so the whole batch can be sent again after the cause is fixed.
 */
export async function applyBatch(
  run: (command: unknown) => Promise<unknown>,
  commands: unknown,
): Promise<BatchResult> {
  if (!Array.isArray(commands))
    throw new Error("A batch is a JSON array of commands");
  if (commands.length > BATCH_MAX)
    throw new Error(`A batch holds at most ${BATCH_MAX} commands`);
  const result: BatchResult = {
    applied: 0,
    replayed: 0,
    failed: 0,
    tally: {},
    errors: [],
  };
  for (const [index, command] of commands.entries()) {
    const name = label(command);
    try {
      const done = (await run(command)) as { replay?: boolean } | undefined;
      if (done?.replay) result.replayed += 1;
      else result.applied += 1;
      result.tally[name] = (result.tally[name] ?? 0) + 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ index, action: name, message: safeMessage(error) });
    }
  }
  return result;
}

async function readInput(limit: number) {
  let data = "";
  for await (const chunk of process.stdin) {
    data += chunk.toString();
    if (Buffer.byteLength(data) > limit) throw new Error("Input is too large");
  }
  return JSON.parse(data) as unknown;
}

export async function runCli(argv = process.argv.slice(2)) {
  const action = argv[0] as Action;
  if (!ACTIONS.includes(action) || argv.length !== 1) throw new Error(USAGE);
  if (!process.env.AMP_DATABASE_URL)
    throw new Error("AMP_DATABASE_URL is required");
  const pool = createDatabasePool({
    connectionString: process.env.AMP_DATABASE_URL,
  });
  try {
    if (action === "report") {
      console.log(
        JSON.stringify(await acquisitionPipelineReport(pool), null, 2),
      );
    } else if (action === "apply") {
      console.log(
        JSON.stringify(
          await runPipelineCommand(pool, await readInput(LIMIT.apply)),
          null,
          2,
        ),
      );
    } else {
      const result = await applyBatch(
        (command) => runPipelineCommand(pool, command),
        await readInput(LIMIT["apply-batch"]),
      );
      console.log(JSON.stringify(result, null, 2));
      if (result.failed) process.exitCode = 1;
    }
  } catch (error) {
    console.error(safeMessage(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

/** Whether this file is the program node was started with. The path is
 * resolved first: through a symlink the two would differ, and the command
 * would exit 0 having done nothing. */
function startedDirectly() {
  try {
    return (
      import.meta.url === pathToFileURL(realpathSync(process.argv[1]!)).href
    );
  } catch {
    return false;
  }
}

if (startedDirectly()) await runCli();
