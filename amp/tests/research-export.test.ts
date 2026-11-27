import test from "node:test";
import assert from "node:assert/strict";
import { Writable } from "node:stream";
import {
  Decrypter,
  generateIdentity,
  generateHybridIdentity,
  identityToRecipient,
} from "age-encryption";
import { EXTRACT_FILES, codebookMarkdown } from "../src/research/codebook.js";
import { encryptStream, recipientsFrom } from "../src/research/encrypt.js";
import { parseArgs, runCli } from "../src/research/export-cli.js";
import {
  studyId,
  studyIdKeyFrom,
  studyIdMapper,
} from "../src/research/study-id.js";
import {
  extractObjectName,
  researchBucketFrom,
  uploadExtract,
} from "../src/research/upload.js";

const key = studyIdKeyFrom({ AMP_RESEARCH_ID_KEY: "k".repeat(32) });
const otherKey = studyIdKeyFrom({ AMP_RESEARCH_ID_KEY: "q".repeat(48) });

test("study IDs are keyed, stable, per study and per kind", () => {
  const id = studyId(key, "rr3", "learner", "learner-1");
  assert.match(
    id,
    /^L-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/,
  );
  assert.equal(studyId(key, "rr3", "learner", "learner-1"), id);
  assert.notEqual(studyId(otherKey, "rr3", "learner", "learner-1"), id);
  assert.notEqual(studyId(key, "rr4", "learner", "learner-1"), id);
  assert.notEqual(studyId(key, "rr3", "learner", "learner-2"), id);
  assert.match(studyId(key, "rr3", "family", "learner-1"), /^F-/);
  assert.notEqual(
    studyId(key, "rr3", "family", "learner-1").slice(2),
    id.slice(2),
  );
  // No id or study code can run into the next field.
  assert.notEqual(
    studyId(key, "rr3", "learner", "a"),
    studyId(key, "rr3a", "learner", ""),
  );
  assert.ok(!id.includes("learner-1"));
});

test("one extract never gives two entities one study ID", () => {
  const ids = studyIdMapper(key, "rr3");
  assert.equal(ids("learner", "a"), ids("learner", "a"));
  assert.notEqual(ids("learner", "a"), ids("learner", "b"));
});

test("the study-ID key fails closed", () => {
  assert.throws(() => studyIdKeyFrom({}), /AMP_RESEARCH_ID_KEY is not set/);
  assert.throws(
    () => studyIdKeyFrom({ AMP_RESEARCH_ID_KEY: "   " }),
    /not set/,
  );
  assert.throws(
    () => studyIdKeyFrom({ AMP_RESEARCH_ID_KEY: "short" }),
    /at least 32 bytes/,
  );
});

test("researcher keys: public age keys only, at least one", async () => {
  const a = await identityToRecipient(await generateIdentity());
  const b = await identityToRecipient(await generateHybridIdentity());
  assert.deepEqual(
    recipientsFrom({
      AMP_RESEARCH_RECIPIENTS: `# Researcher one\n${a}\n${b}, ${a}\n`,
    }),
    [a, b],
  );
  assert.throws(() => recipientsFrom({}), /names no key/);
  assert.throws(
    () => recipientsFrom({ AMP_RESEARCH_RECIPIENTS: "# nobody yet" }),
    /names no key/,
  );
  const secret = await generateIdentity();
  assert.throws(
    () => recipientsFrom({ AMP_RESEARCH_RECIPIENTS: secret }),
    /private key/,
  );
  assert.throws(
    () => recipientsFrom({ AMP_RESEARCH_RECIPIENTS: "ssh-ed25519 AAAA" }),
    /not an age public key/,
  );
  assert.throws(() =>
    recipientsFrom({ AMP_RESEARCH_RECIPIENTS: "age1notakey" }),
  );
});

async function collect(stream: AsyncIterable<Uint8Array>) {
  const parts: Uint8Array[] = [];
  for await (const part of stream) parts.push(part);
  return Buffer.concat(parts);
}

test("age round trip: every named researcher decrypts the stream", async () => {
  const one = await generateIdentity();
  const two = await generateHybridIdentity();
  const outsider = await generateIdentity();
  const recipients = [
    await identityToRecipient(one),
    await identityToRecipient(two),
  ];
  // Several chunks across age's 64 KiB boundary.
  const chunks = [
    Buffer.alloc(70_000, 1),
    Buffer.from("middle"),
    Buffer.alloc(140_000, 2),
  ];
  const plaintext = Buffer.concat(chunks);
  const ciphertext = await collect(
    await encryptStream(
      (async function* () {
        yield* chunks;
      })(),
      recipients,
    ),
  );
  assert.ok(
    ciphertext.subarray(0, 21).toString().startsWith("age-encryption.org/v1"),
  );
  assert.equal(ciphertext.indexOf(Buffer.from("middle")), -1);
  for (const identity of [one, two]) {
    const decrypter = new Decrypter();
    decrypter.addIdentity(identity);
    assert.deepEqual(
      Buffer.from(await decrypter.decrypt(ciphertext)),
      plaintext,
    );
  }
  const wrong = new Decrypter();
  wrong.addIdentity(outsider);
  await assert.rejects(wrong.decrypt(ciphertext));
});

test("object names carry the study and the time only", () => {
  assert.equal(
    extractObjectName("rr3", new Date("2026-11-27T14:05:01.234Z")),
    "rr3/rr3-20261127T140501Z.zip.age",
  );
  assert.throws(() => extractObjectName("../x", new Date()));
  assert.equal(
    researchBucketFrom({ AMP_RESEARCH_BUCKET: "amp-research-x" }),
    "amp-research-x",
  );
  assert.throws(() => researchBucketFrom({}), /not set/);
  assert.throws(
    () => researchBucketFrom({ AMP_RESEARCH_BUCKET: "gs://b/x" }),
    /bare bucket/,
  );
});

test("the upload never replaces an object", async () => {
  const written: Buffer[] = [];
  let options: Record<string, unknown> | undefined;
  let target: string[] = [];
  const storage = {
    bucket: (bucket: string) => ({
      file: (object: string) => ({
        createWriteStream: (given: Record<string, unknown>) => {
          target = [bucket, object];
          options = given;
          return new Writable({
            write(chunk, _encoding, done) {
              written.push(chunk);
              done();
            },
          });
        },
      }),
    }),
  };
  const { Readable } = await import("node:stream");
  await uploadExtract(
    Readable.from([Buffer.from("cipher"), Buffer.from("text")]),
    { bucket: "amp-research-x", object: "rr3/rr3-20261127T140501Z.zip.age" },
    storage as never,
  );
  assert.deepEqual(target, [
    "amp-research-x",
    "rr3/rr3-20261127T140501Z.zip.age",
  ]);
  assert.deepEqual(options?.preconditionOpts, { ifGenerationMatch: 0 });
  assert.equal(Buffer.concat(written).toString(), "ciphertext");
});

test("the command checks its configuration before it opens the database", async () => {
  assert.deepEqual(parseArgs(["--study", "rr3"]), {
    study: "rr3",
    output: undefined,
  });
  assert.throws(() => parseArgs([]), /Usage/);
  assert.throws(() => parseArgs(["--study"]), /Usage/);
  assert.throws(() => parseArgs(["--study", "RR3"]), /study code/);
  assert.throws(() => parseArgs(["--study", "rr3", "--extra", "x"]), /Usage/);
  const recipient = await identityToRecipient(await generateIdentity());
  const env = {
    AMP_RESEARCH_ID_KEY: "k".repeat(32),
    AMP_RESEARCH_RECIPIENTS: recipient,
    AMP_RESEARCH_BUCKET: "amp-research-x",
    // Unreachable: any attempt to connect would fail differently.
    AMP_DATABASE_URL: "postgres://nobody@127.0.0.1:1/none",
  };
  for (const [name, message] of [
    ["AMP_RESEARCH_ID_KEY", /AMP_RESEARCH_ID_KEY is not set/],
    ["AMP_RESEARCH_RECIPIENTS", /names no key/],
    ["AMP_RESEARCH_BUCKET", /AMP_RESEARCH_BUCKET is not set/],
    ["AMP_DATABASE_URL", /AMP_DATABASE_URL is required/],
  ] as const) {
    const { [name]: _dropped, ...rest } = env;
    await assert.rejects(runCli(["--study", "rr3"], rest), message);
  }
});

/** Column names that would mean a direct identifier, a date or free text. */
const DENIED =
  /(^|_)(name|names|email|e_mail|account|account_id|learner_id|person|ip|address|phone|birth|birth_year|dob|response|note|notes|text|comment|date|day|timestamp|at|code|token|uuid)($|_)/;

test("the codebook declares no identifying, dated or free-text column", () => {
  const names = new Set<string>();
  for (const file of EXTRACT_FILES) {
    assert.ok(names.add(file.name), `${file.name} once`);
    const columns = file.columns.map((column) => column.name);
    assert.equal(
      new Set(columns).size,
      columns.length,
      `${file.name} columns unique`,
    );
    for (const column of columns) {
      if (column === "study_learner_id" || column === "study_family_id")
        continue;
      assert.doesNotMatch(column, DENIED, `${file.name} ${column}`);
    }
    if (file.name !== "skills.csv")
      assert.equal(
        columns[0],
        "study_learner_id",
        `${file.name} is keyed by study ID`,
      );
  }
  // Every participant file can be joined on the same key.
  assert.match(codebookMarkdown("rr3"), /## answers\.csv/);
});
