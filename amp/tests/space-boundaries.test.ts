import assert from "node:assert/strict";
import test from "node:test";
import { check, findings } from "../scripts/check-space-boundaries.js";

test("the shared widgets carry no space branches today", () => {
  const { checked, found } = check();
  assert.ok(checked > 40, `checked ${checked}`);
  assert.deepEqual(found, []);
});

test("the lint catches each way a widget could guess its space", () => {
  const caught = (source: string) => findings("ui/Widget.tsx", source);
  for (const source of [
    'const label = org.kind === "family" ? "child" : "student";',
    'if ("school" === org.kind) return null;',
    'return space === "family" ? a : b;',
    "export function Widget({ family }: { family: boolean }) {",
    "  family?: boolean;",
    "<JoinClass family={true} />",
    "const mine = me.familyClass?.classId;",
    "const shared = me.secondParentOf ?? [];",
    "const schools = me.staffOf;",
    "const teachingHere = inSchool;",
    'import { resolveSpace } from "../features/spaces/resolve";',
    'import { useSpace } from "../../spaces/useSpace";',
    'import { useSchoolNavigation } from "../navigation/school-navigation";',
    'import { placesFor } from "../onboarding/guard";',
    'import { secondParentChild } from "../second-parent/api";',
  ])
    assert.equal(caught(source).length, 1, source);
});

test("words as props, comments and ordinary code pass", () => {
  for (const source of [
    'import type { SpaceWords } from "../../spaces/words";',
    "// A family's class says child; the caller decides.",
    ' * kind === "family" in a comment',
    "/* family: boolean */",
    "const words: SpaceWords = props.words;",
    'const error = failure.kind === "network";',
    "const font = 'font-family';",
  ])
    assert.deepEqual(findings("ui/Widget.tsx", source), [], source);
});
