import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPair, exportPKCS8, exportSPKI, CompactSign } from "jose";
import { randomUUID } from "node:crypto";
import {
  packSigner,
  verifyPack,
  assertPackAuthorization,
  offlineSigningConfiguration,
} from "../src/offline/signing.js";
import { generateProblem, templates } from "../src/math/engine.js";
import { gradeOfflineV1, normalizeAnswer } from "../src/offline/grader-v1.js";
import { planMixedPractice } from "../src/server/mixed-practice.js";
import {
  supportedOfflineTemplates,
  uniquePoolChoices,
} from "../src/offline/repository.js";
import {
  issueSchema,
  reconcileSchema,
  type OfflinePack,
} from "../src/offline/contracts.js";
import type { TemplateMetadata } from "../src/math/contracts.js";
import type { Outcome } from "../src/server/repository.js";
const template = (
  id: string,
  band: TemplateMetadata["gradeBand"],
): TemplateMetadata => ({
  id,
  skillId: id,
  version: 1,
  title: id,
  description: id,
  gradeBand: band,
});
const early = template("early", "K–2"),
  hard = template("hard", "9–12");
const nodes = [
  { id: "early", strand: "number", prerequisites: [] },
  { id: "hard", strand: "algebra", prerequisites: [] },
];
const observation = (
  t: TemplateMetadata,
  correct: boolean,
  assisted = false,
): Outcome => ({
  id: randomUUID(),
  problemId: randomUUID(),
  requestId: randomUUID(),
  skillId: t.skillId,
  templateId: t.id,
  correct,
  assisted,
  response: "1",
  answer: "1",
  explanation: [],
  createdAt: "2026-01-01T00:00:00.000Z",
});
test("offline pool shrinks rather than filling with unrelated harder tasks; ordinary planner unchanged", () => {
  const options = {
    templates: [early, hard],
    skills: nodes,
    attempts: [],
    evidence: [],
    count: 5,
    seed: "small",
  };
  assert.ok(planMixedPractice(options).some((c) => c.template.id === "hard"));
  for (let i = 0; i < 100; i++)
    assert.deepEqual(
      uniquePoolChoices(
        planMixedPractice({ ...options, seed: String(i), strictCeiling: true }),
      ).map((c) => c.template.id),
      ["early"],
    );
  assert.equal(
    planMixedPractice({ ...options, templates: [hard], strictCeiling: true })
      .length,
    0,
  );
});
test("offline pool preserves genuine support and independently successful due reviews, never prior-only high failures", () => {
  const support = template("support", "3–5");
  const opts = {
    templates: [early, support, hard],
    skills: [
      ...nodes.map((n) =>
        n.id === "hard" ? { ...n, prerequisites: ["support"] } : n,
      ),
      { id: "support", strand: "number", prerequisites: [] },
    ],
    attempts: [observation(hard, false)],
    evidence: [],
    count: 5,
    seed: "support",
    strictCeiling: true,
    now: Date.parse("2026-01-03T00:00:00Z"),
    startingPoint: {
      band: "9–12" as const,
      policyVersion: 1 as const,
      excludedStrands: [],
    },
  };
  const copy = JSON.stringify(opts);
  const choices = planMixedPractice(opts);
  assert.ok(
    choices.some(
      (c) => c.template.id === "support" && c.reason === "prerequisite",
    ),
  );
  assert.ok(!choices.some((c) => c.template.id === "hard"));
  assert.equal(JSON.stringify(opts), copy);
  assert.ok(
    planMixedPractice({ ...opts, attempts: [observation(hard, true)] }).some(
      (c) => c.template.id === "hard" && c.reason === "review",
    ),
  );
  assert.ok(
    !planMixedPractice({
      ...opts,
      attempts: [observation(hard, true, true)],
    }).some((c) => c.template.id === "hard"),
  );
});
test("capabilities are explicit; request bodies cannot claim evidence or trusted time", () => {
  const choice = {
    ...hard,
    requiredResponseCapability: "single-choice-v1" as const,
  };
  const visual = {
    ...early,
    requiredFigureCapability: "measurement-models-v1" as const,
  };
  const legacy = issueSchema.parse({ requestId: randomUUID() });
  const measurement = templates.filter(
    (t) => t.requiredFigureCapability === "measurement-models-v1",
  );
  assert.ok(measurement.length > 0);
  assert.equal(supportedOfflineTemplates(legacy, measurement).length, 0);
  assert.deepEqual(
    supportedOfflineTemplates(
      { ...legacy, figureCapabilities: ["measurement-models-v1"] },
      measurement,
    ),
    measurement,
  );
  assert.deepEqual(supportedOfflineTemplates(legacy, [choice, visual, early]), [
    early,
  ]);
  assert.equal(
    supportedOfflineTemplates(
      {
        ...legacy,
        responseCapabilities: ["single-choice-v1"],
        figureCapabilities: ["measurement-models-v1"],
      },
      [choice, visual],
    ).length,
    2,
  );
  assert.equal(
    issueSchema.safeParse({ ...legacy, mastered: true }).success,
    false,
  );
  assert.equal(
    reconcileSchema.safeParse({
      attempts: [
        {
          requestId: randomUUID(),
          problemId: "a".repeat(64),
          response: "1",
          independent: true,
        },
      ],
    }).success,
    false,
  );
});
test("version-one canonical grading uses exact literals and semantic option IDs", () => {
  const p = generateProblem("add-fractions", "canonical");
  p.answer = "1/2";
  for (const answer of ["0.5", "2/4", "−1/-2", ".5"])
    assert.equal(gradeOfflineV1(p, answer), true);
  for (const answer of [
    "0.500000000000000001",
    "1/0",
    "1e-1",
    "Math.random()",
    "",
    "9".repeat(101),
  ])
    assert.equal(gradeOfflineV1(p, answer), false);
  assert.equal(normalizeAnswer("-0"), "0");
  p.public.response = {
    kind: "choice",
    label: "Choose",
    options: [
      { id: "opt-a", label: "1/2" },
      { id: "opt-b", label: "2/3" },
    ],
  };
  p.answer = "opt-a";
  assert.equal(gradeOfflineV1(p, "opt-a"), true);
  assert.equal(gradeOfflineV1(p, "1/2"), false);
  assert.equal(gradeOfflineV1(p, "opt-b"), false);
});
test("signed envelope rejects tampering, foreign keys, unexpected profiles and unbounded data", async () => {
  const keys = await generateKeyPair("EdDSA", { extractable: true });
  const signer = await packSigner(
    await exportPKCS8(keys.privateKey),
    await exportSPKI(keys.publicKey),
    "test-key",
    "https://offline.example.test/amp",
    new Uint8Array(32).fill(3),
  );
  const p = generateProblem("add-within-20", "sign");
  const pack: OfflinePack = {
    format: "amp-offline-v1",
    serviceId: signer.serviceId,
    accountBinding: signer.bind("account", ["synthetic"]),
    authorization: {
      consentRevision: signer.bind("consent", ["one"]),
      grantBinding: signer.bind("grant", ["one"]),
    },
    packId: randomUUID(),
    learnerId: randomUUID(),
    issuedAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-01-02T00:00:00.000Z",
    selectionPolicy: "mixed-five-three-variants-v1",
    evidence: "offline-provisional",
    capabilities: { responseCapabilities: [], figureCapabilities: [] },
    items: [
      {
        problem: p.public,
        graderVersion: 1,
        reason: "frontier",
        strand: "number",
        selfCheck: {
          answer: p.answer,
          hint: p.hint,
          explanation: p.explanation,
        },
      },
    ],
  };
  const signed = await signer.sign(pack);
  assert.deepEqual(await verifyPack(signed, keys.publicKey, "test-key"), pack);
  assert.doesNotThrow(() => assertPackAuthorization(pack, pack));
  for (const changed of [
    { serviceId: "https://foreign.example.test/amp" },
    { accountBinding: "0".repeat(64) },
    { learnerId: randomUUID() },
    {
      authorization: { ...pack.authorization, consentRevision: "0".repeat(64) },
    },
  ])
    assert.throws(() => assertPackAuthorization(pack, { ...pack, ...changed }));
  const rotated = await generateKeyPair("EdDSA", { extractable: true });
  const nextSigner = await packSigner(
    await exportPKCS8(rotated.privateKey),
    await exportSPKI(rotated.publicKey),
    "rotated",
    signer.serviceId,
    new Uint8Array(32).fill(3),
  );
  assert.equal(nextSigner.bind("account", ["synthetic"]), pack.accountBinding);
  for (const service of [
    "http://offline.example.test/amp",
    "https://user@offline.example.test/amp",
    "https://offline.example.test/amp?token=bad",
    "https://offline.example.test/amp#fragment",
    "https://OFFLINE.example.test/amp",
  ])
    await assert.rejects(
      packSigner(
        await exportPKCS8(keys.privateKey),
        await exportSPKI(keys.publicKey),
        "test",
        service,
        new Uint8Array(32),
      ),
    );

  const pieces = signed.split(".");
  pieces[1] = Buffer.from(
    JSON.stringify({ ...pack, learnerId: randomUUID() }),
  ).toString("base64url");
  await assert.rejects(
    verifyPack(pieces.join("."), keys.publicKey, "test-key"),
  );
  await assert.rejects(
    verifyPack(signed, (await generateKeyPair("EdDSA")).publicKey, "test-key"),
  );
  await assert.rejects(verifyPack(signed, keys.publicKey, "other"));
  const wrong = await new CompactSign(
    new TextEncoder().encode(JSON.stringify(pack)),
  )
    .setProtectedHeader({ alg: "EdDSA", kid: "test-key", typ: "JWT" })
    .sign(keys.privateKey);
  await assert.rejects(verifyPack(wrong, keys.publicKey, "test-key"));
  await assert.rejects(
    verifyPack("a".repeat(524289), keys.publicKey, "test-key"),
  );
  assert.equal(await offlineSigningConfiguration({}), null);
  await assert.rejects(
    offlineSigningConfiguration({ AMP_OFFLINE_PACKS: "enabled" }),
  );
});
