/**
 * Shrinks the plain-language baseline (tests/fixtures/plain-language-baseline.json).
 *
 *   npm run plain:baseline              remove fixed violations; refuse new ones
 *   npm run plain:baseline -- --new-terms=id,id
 *                                       also record violations of these glossary
 *                                       terms, which must be entries added since
 *                                       the baseline was written
 *   npm run plain:baseline -- --from-senses
 *                                       also record undefined first uses that
 *                                       come only from linking (a newly named
 *                                       sense or glossary form): accepted only
 *                                       on screens whose text hash is unchanged
 *   npm run plain:baseline -- --report  print counts per band; write nothing
 *   npm run plain:baseline -- --init    create the file when it does not exist
 *
 * The baseline only shrinks. Fix a new violation where the text lives: define
 * the term in the sentence where it first appears on that screen, or split the
 * long sentence. `tests/plain-language.test.ts` fails on new and stale entries.
 * After a merge conflict in the file, take main's copy and run this again:
 *   git checkout origin/main -- tests/fixtures/plain-language-baseline.json
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  acceptedGrowth,
  currentBaseline,
  diffBaseline,
  plainLanguageViolations,
  violationText,
  type PlainLanguageBaseline,
} from "../src/content/plain-language-check";
import { gradeBandOrder } from "../src/content/lesson-text";
import { hasGlossaryEntry } from "../src/glossary/index";

const path = new URL(
  "../tests/fixtures/plain-language-baseline.json",
  import.meta.url,
);
const args = process.argv.slice(2);
const newTermsArg = args.find((a) => a.startsWith("--new-terms="));
for (const a of args)
  if (a !== newTermsArg && !["--report", "--init", "--from-senses"].includes(a))
    throw new Error(`Unknown option ${a}`);

if (args.includes("--report")) {
  const all = plainLanguageViolations();
  const row = (
    label: string,
    screens: typeof all extends Map<string, infer V> ? V[] : never,
  ) =>
    `| ${label} | ${screens.length} | ${screens.filter((v) => !v.terms.length && !v.long.length).length} | ${screens.reduce((n, v) => n + v.terms.length, 0)} | ${screens.reduce((n, v) => n + v.long.length, 0)} |`;
  console.log(
    [
      "| Band | Screens | Clear | Undefined first uses | Long sentences |",
      "| --- | ---: | ---: | ---: | ---: |",
      ...gradeBandOrder.map((b) =>
        row(
          b,
          [...all.values()].filter((v) => v.band === b),
        ),
      ),
      row("all", [...all.values()]),
    ].join("\n"),
  );
  process.exit(0);
}

const current = currentBaseline();
if (!existsSync(path)) {
  if (!args.includes("--init"))
    throw new Error(
      "No baseline: take main's copy (git checkout origin/main -- tests/fixtures/plain-language-baseline.json); --init only creates it the first time",
    );
  writeFileSync(path, JSON.stringify(current, null, 2) + "\n");
  console.log(
    `Created the baseline: ${Object.keys(current.screens).length} screens.`,
  );
  process.exit(0);
}
const baseline: PlainLanguageBaseline = JSON.parse(readFileSync(path, "utf8"));
const newTerms = (newTermsArg?.slice("--new-terms=".length) ?? "")
  .split(",")
  .filter(Boolean);
for (const id of newTerms) {
  if (!hasGlossaryEntry(id)) throw new Error(`No glossary entry ${id}`);
  if (baseline.glossary.includes(id))
    throw new Error(
      `${id} was in the glossary when the baseline was written; define it where it is used`,
    );
}
const { grown, stale } = diffBaseline(current.screens, baseline.screens);
const fromSenses = args.includes("--from-senses");
const { refused } = acceptedGrowth(grown, baseline.screens, current.screens, {
  newTerms,
  fromSenses,
});
if (refused.length) {
  console.error(
    `Refusing to grow the plain-language baseline. Define each term in the sentence where it first appears on that screen ("X is called …", "X means …", "X, the …,"), or split the sentence:\n${refused.map((v) => violationText(v) + (v.textChanged ? " (its text changed since the baseline was written)" : "")).join("\n")}`,
  );
  process.exit(1);
}
// Every current violation is now recorded or allowed, so the current state
// is the shrunk baseline.
writeFileSync(path, JSON.stringify(current, null, 2) + "\n");
console.log(
  `Wrote ${Object.keys(current.screens).length} screens: removed ${stale.length} fixed violations${grown.length ? `, recorded ${grown.length} ${fromSenses ? "from newly linked words on unchanged text" : `for new glossary terms ${newTerms.join(", ")}`}` : ""}.`,
);
