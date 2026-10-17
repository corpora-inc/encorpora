/** Pipe stdout to independent-math-review.py; this script does not certify answers. */
import { once } from "node:events";
import { generateProblem, templates } from "../src/math/engine.js";

function configuration(args: string[]): {
  seedStart: number;
  seedCount: number;
} {
  let seedStart = 0,
    seedCount = 256;
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]!,
      value = args[index + 1];
    if (
      !["--seeds", "--start"].includes(flag) ||
      seen.has(flag) ||
      !value ||
      !/^\d+$/.test(value)
    )
      throw new Error(
        "Usage: tsx scripts/export-math-cases.ts [--seeds COUNT>=256] [--start INDEX>=0]",
      );
    seen.add(flag);
    const number = Number(value);
    if (!Number.isSafeInteger(number))
      throw new Error("Seed bounds must be safe integers");
    if (flag === "--seeds") seedCount = number;
    else seedStart = number;
  }
  if (seedCount < 256 || !Number.isSafeInteger(seedStart + seedCount))
    throw new Error(
      "At least 256 seeds per family and a safe ending index are required",
    );
  return { seedStart, seedCount };
}
async function write(value: unknown): Promise<void> {
  if (!process.stdout.write(`${JSON.stringify(value)}\n`))
    await once(process.stdout, "drain");
}
async function main(): Promise<void> {
  const config = configuration(process.argv.slice(2));
  const ids = templates.map((template) => template.id);
  if (ids.length === 0 || new Set(ids).size !== ids.length)
    throw new Error("Template inventory is empty or has duplicate IDs");
  await write({ kind: "manifest", format: 1, templates: ids, ...config });
  for (const id of ids) {
    for (
      let index = config.seedStart;
      index < config.seedStart + config.seedCount;
      index++
    ) {
      await write({
        kind: "case",
        problem: generateProblem(id, `independent-${index}`),
      });
    }
  }
}
main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Export failed"}\n`,
  );
  process.exitCode = 1;
});
