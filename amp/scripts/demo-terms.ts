/**
 * Makes the shared demo school's shipped terms (`src/schools/demo/terms/`,
 * read by `src/schools/demo/snapshot.ts`): one per weekday, the production
 * planner and estimator over every simulated answer, on worker threads. A
 * weekday whose manifest key is still current is kept, so after a
 * `DEMO_TERM_VERSION` bump or a roster change this computes only what
 * changed. It is a developer-machine job (700 to 900 CPU seconds a weekday,
 * up to 6.6 GB with eight threads; 18 minutes for all seven on a 12-core
 * laptop), never an image build or a pod.
 *
 *     npm run demo:terms                 # compute the stale weekdays
 *     npm run demo:terms -- --force      # compute every weekday again
 *     npm run demo:terms -- --check 2    # recompute Wednesday; compare
 *
 * `--check` proves a shipped term is what the engine makes today. After an
 * engine change it may differ, and that is fine: a shipped term is the
 * engine's output when it was made, as a real student's history is.
 */
import { isDeepStrictEqual } from "node:util";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { brotliDecompressSync } from "node:zlib";
import { simulateJobs } from "../src/schools/demo/simulate-pool";
import {
  decodeTerms,
  encodeTerms,
  MANIFEST,
  readManifest,
  sha256,
  shippedKey,
  termFile,
  TERMS_DIR,
  variantJobs,
  WEEKDAYS,
  type Manifest,
} from "../src/schools/demo/snapshot";

/** The hygiene check refuses files over 5 MiB. */
const MAX_BYTES = 5 * 1024 * 1024;
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const checkAt = args.indexOf("--check");

async function compute(weekday: number) {
  const jobs = variantJobs("school", weekday);
  const cpu = process.cpuUsage();
  const started = performance.now();
  const terms = await simulateJobs(jobs);
  const used = process.cpuUsage(cpu);
  return {
    terms,
    seconds: (performance.now() - started) / 1000,
    cpuSeconds: (used.user + used.system) / 1e6,
  };
}

if (checkAt >= 0) {
  const weekday = Number(args[checkAt + 1]);
  if (!WEEKDAYS.includes(weekday as never))
    throw new Error("--check takes a weekday, 0 (Monday) to 6");
  const bytes = readFileSync(new URL(termFile(weekday), TERMS_DIR));
  const entry = readManifest()?.weekdays.find((row) => row.weekday === weekday);
  if (entry?.key !== shippedKey(weekday) || entry.sha256 !== sha256(bytes))
    throw new Error(`w${weekday}: the shipped term is stale; run demo:terms`);
  const shipped = decodeTerms(bytes);
  const fresh = await compute(weekday);
  const same = isDeepStrictEqual(shipped, fresh.terms);
  console.log(
    JSON.stringify({
      weekday,
      students: shipped.length,
      answers: shipped.reduce((sum, term) => sum + term.answers.length, 0),
      matchesFreshCompute: same,
      seconds: Math.round(fresh.seconds),
      cpuSeconds: Math.round(fresh.cpuSeconds),
    }),
  );
  process.exit(same ? 0 : 1);
}

mkdirSync(TERMS_DIR, { recursive: true });
const manifest: Manifest = { version: 2, weekdays: [] };
// Files of another encoding are made again.
const before =
  readManifest()?.version === manifest.version ? readManifest() : null;
const started = performance.now();
for (const weekday of WEEKDAYS) {
  const key = shippedKey(weekday);
  const file = new URL(termFile(weekday), TERMS_DIR);
  const known = before?.weekdays.find((row) => row.weekday === weekday);
  let current = false;
  if (!flag("--force") && known?.key === key)
    try {
      current = sha256(readFileSync(file)) === known.sha256;
    } catch {
      current = false;
    }
  if (current) {
    manifest.weekdays.push(known!);
    console.log(JSON.stringify({ weekday, key, kept: true }));
    continue;
  }
  const made = await compute(weekday);
  const bytes = await encodeTerms(made.terms);
  if (bytes.length > MAX_BYTES)
    throw new Error(`w${weekday} is ${bytes.length} bytes, over 5 MiB`);
  // What a pod reads is what was computed.
  if (!isDeepStrictEqual(decodeTerms(bytes), made.terms))
    throw new Error(`w${weekday} does not decode to its term`);
  writeFileSync(file, bytes);
  manifest.weekdays.push({
    weekday,
    key,
    bytes: bytes.length,
    sha256: sha256(bytes),
    textBytes: brotliDecompressSync(bytes).length,
  });
  console.log(
    JSON.stringify({
      weekday,
      key,
      students: made.terms.length,
      answers: made.terms.reduce((sum, term) => sum + term.answers.length, 0),
      bytes: bytes.length,
      seconds: Math.round(made.seconds),
      cpuSeconds: Math.round(made.cpuSeconds),
    }),
  );
}
writeFileSync(
  new URL(MANIFEST, TERMS_DIR),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(
  `demo terms ready in ${Math.round((performance.now() - started) / 1000)} s`,
);
