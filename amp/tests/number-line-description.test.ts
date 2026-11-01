import { test } from "node:test";
import assert from "node:assert/strict";
import { generateProblem } from "../src/math/engine";
import { describeScene } from "../src/math/scene/layout";
import type { Scene } from "../src/math/scene/spec";

test("an open number line's description names each point by its letter", () => {
  for (const id of ["open-number-line-to-120", "open-number-line-to-1000"])
    for (let i = 0; i < 80; i++) {
      const p = generateProblem(id, `letters-${i}`);
      const figure = p.public.figure as { kind: string; scene: Scene };
      const text = describeScene(figure.scene);
      const letters = [...p.public.prompt.matchAll(/\$([A-Z])\$/g)].map(
        (m) => m[1]!,
      );
      const asked =
        letters.length > 0
          ? letters
          : (p.public.response as { options?: { label: string }[] })
              .options!.map((o) => /\$([A-Z])\$/.exec(o.label)?.[1])
              .filter((l): l is string => !!l);
      for (const letter of asked)
        assert.match(
          text,
          new RegExp(`Point ${letter}\\b`),
          `${id} ${i}: ${text}`,
        );
      // Read the point without being told its number: the learner counts ticks.
      if (/at point \$P\$/.test(p.public.prompt)) {
        const answer = (
          p.public.response as { options: { id: string; label: string }[] }
        ).options.find((o) => o.id === p.answer)!.label;
        const sentence = /Point P [^.]*\./.exec(text)![0];
        assert.doesNotMatch(
          sentence,
          new RegExp(`\\b${answer}\\b`),
          `${id} ${i}: ${sentence}`,
        );
      }
    }
});
