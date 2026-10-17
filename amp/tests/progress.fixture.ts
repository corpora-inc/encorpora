import { randomUUID } from "node:crypto";
import { generateProblem } from "../src/math/engine.js";
import type { PostgresRepository } from "../src/server/repository.js";
export async function seedProgress(
  repository: PostgresRepository,
  account: string,
  name = "Practice explorer",
) {
  const learner = await repository.create(account, name),
    now = Date.now(),
    hour = 3600000;
  const cases: [string, boolean, boolean, number][] = [
    ...Array.from(
      { length: 5 },
      (_, i) =>
        ["count-objects", true, false, now - hour + i] as [
          string,
          boolean,
          boolean,
          number,
        ],
    ),
    ["multiply-facts", true, false, now - 36 * hour],
    ["multiply-facts", true, false, now - 12 * hour],
    ["linear-equation", true, false, now - 72 * hour],
    ["fraction-equivalence-choice", true, true, now - 2 * hour],
    ["graph-equation-choice", false, false, now - 24 * hour],
    ["rectangle-area", true, false, now - hour],
    ["mean-data", false, false, now - 60000],
    ["integer-addition", true, false, now - 2 * hour],
  ];
  await repository.transaction(account, learner.id, async (tx) => {
    for (const [templateId, correct, assisted, at] of cases) {
      const p = generateProblem(templateId, randomUUID());
      await tx.saveProblem(p);
      const wrong =
        p.public.response.kind === "choice"
          ? p.public.response.options.find((o) => o.id !== p.answer)!.id
          : p.answer === "99999"
            ? "99998"
            : "99999";
      await tx.saveAttempt({
        id: randomUUID(),
        requestId: randomUUID(),
        problemId: p.public.id,
        skillId: p.public.skillId,
        templateId,
        response: correct ? p.answer : wrong,
        correct,
        assisted,
        answer: p.answer,
        explanation: p.explanation,
        createdAt: new Date(at).toISOString(),
      });
    }
  });
  return learner;
}
