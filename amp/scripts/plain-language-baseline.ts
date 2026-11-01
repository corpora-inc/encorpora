/**
 * Shrinks the plain-language baseline (tests/fixtures/plain-language-baseline.json).
 *
 *   npm run plain:baseline                  remove fixed violations; refuse new ones
 *   npm run plain:baseline -- --new-terms   also record violations of glossary
 *                                           terms the baseline has never named
 *                                           (a glossary entry added since)
 *   npm run plain:baseline -- --report      print counts per band; write nothing
 *
 * The baseline only shrinks. A new violation is fixed where the text lives:
 * define the term in the sentence where it first appears on that screen, or
 * split the long sentence. `tests/plain-language.test.ts` fails on new and on
 * stale entries.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  currentBaseline,
  diffBaseline,
  type PlainLanguageBaseline,
} from "../src/content/plain-language-check";
import { lessonUnits } from "../src/content/lesson-units";
import { gradeBandOrder } from "../src/content/lesson-text";

const path = new URL(
  "../tests/fixtures/plain-language-baseline.json",
  import.meta.url,
);
const args = process.argv.slice(2);
for (const a of args)
  if (!["--new-terms", "--report"].includes(a))
    throw new Error(`Unknown option ${a}`);

const current = currentBaseline();
const baseline: PlainLanguageBaseline = existsSync(path)
  ? JSON.parse(readFileSync(path, "utf8"))
  : {};

if (args.includes("--report")) {
  const band = new Map(lessonUnits().map((u) => [u.id, u.band]));
  const rows = gradeBandOrder.map((b) => {
    const ids = Object.keys(current).filter((id) => band.get(id) === b);
    const units = [...band.values()].filter((x) => x === b).length;
    const terms = ids.reduce((n, id) => n + current[id]!.undefined.length, 0);
    const long = ids.reduce((n, id) => n + current[id]!.long, 0);
    return `| ${b} | ${units} | ${units - ids.length} | ${terms} | ${long} |`;
  });
  const all = Object.values(current);
  console.log(
    [
      "| Band | Lessons | Clear | Undefined first uses | Long sentences |",
      "| --- | ---: | ---: | ---: | ---: |",
      ...rows,
      `| all | ${band.size} | ${band.size - all.length} | ${all.reduce((n, v) => n + v.undefined.length, 0)} | ${all.reduce((n, v) => n + v.long, 0)} |`,
    ].join("\n"),
  );
  process.exit(0);
}

const existed = existsSync(path);
const { grown, stale } = diffBaseline(current, baseline);
const known = new Set(
  Object.values(baseline).flatMap((v) =>
    v.undefined.map((t) => t.split("/").at(-1)!),
  ),
);
// A glossary entry added after the baseline was written is new to every
// lesson; --new-terms records those, and nothing else.
const newTerm = (line: string) =>
  args.includes("--new-terms") &&
  !line.includes("long sentences") &&
  !known.has(line.split("/").at(-1)!);
const refused = existed ? grown.filter((g) => !newTerm(g)) : [];
if (refused.length) {
  console.error(
    `Refusing to grow the plain-language baseline. Define each term in the sentence where it first appears on that screen ("X is called …", "X means …", "X, the …,"), or split the sentence:\n${refused.join("\n")}`,
  );
  process.exit(1);
}
// Keep only what the baseline already records, plus allowed new terms.
const next: PlainLanguageBaseline = {};
for (const [id, v] of Object.entries(current)) {
  const was = baseline[id] ?? { undefined: [], long: 0 };
  const undefinedTerms = existed
    ? v.undefined.filter(
        (t) => was.undefined.includes(t) || newTerm(`${id}: ${t}`),
      )
    : v.undefined;
  const long = existed ? Math.min(v.long, was.long) : v.long;
  if (undefinedTerms.length || long)
    next[id] = { undefined: undefinedTerms, long };
}
writeFileSync(path, JSON.stringify(next, null, 2) + "\n");
console.log(
  existed
    ? `Wrote ${Object.keys(next).length} lessons; removed ${stale.length} fixed violations${grown.length ? `, recorded ${grown.length} for new glossary terms` : ""}.`
    : `Created the baseline: ${Object.keys(next).length} lessons.`,
);
