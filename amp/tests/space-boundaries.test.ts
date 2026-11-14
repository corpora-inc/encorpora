import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { check, findings, reaches } from "../scripts/check-space-boundaries.js";

test("the shared widgets carry no space branches today", () => {
  const { checked, found } = check();
  assert.ok(checked > 40, `checked ${checked}`);
  assert.deepEqual(found, []);
});

test("the lint reads the syntax tree: every way a widget could guess its space", () => {
  for (const source of [
    'const label = org.kind === "family" ? "child" : "student";',
    // CP-2 M2: split across lines.
    'const label = org.kind ===\n  "family" ? "child" : "student";',
    // A switch.
    'switch (org.kind) { case "family": return "child"; }',
    // Element access, optional chaining, reversed operands.
    'const label = org["kind"] === "family" ? "child" : "student";',
    'if (org?.kind !== "school") return null;',
    'if ("district" == place.kind) return null;',
    'return space === "family" ? a : b;',
    "export function Widget({ family }: { family: boolean }) {}",
    "type Props = { family?: boolean };",
    "const x = <JoinClass family />;",
    "const mine = me.familyClass?.classId;",
    "const shared = me.secondParentOf ?? [];",
    "const schools = me.staffOf;",
    "const teachingHere = inSchool;",
    // Choosing its own words or space.
    // CP-2 r2 M2: aliases, element access, a failure-like name, a table.
    'const { kind: placeKind } = org;\nconst label = placeKind === "family" ? "child" : "student";',
    'const k = org.kind;\nconst label = k === "family" ? "child" : "student";',
    'const label = context["space"] === "family" ? "child" : "student";',
    'const label = result.kind === "family" ? "child" : "student";',
    'const label = { family: "child", school: "student" }[org.kind];',
    'const NOUN = { family: "child", school: "student" };\nconst label = NOUN[org.kind];',
    'const words = spaceWords("family");',
    "const here = spaceOfPath(location.pathname);",
  ])
    assert.ok(
      findings("ui/Widget.tsx", source).length > 0,
      `not caught: ${source}`,
    );
});

test("words as props, failures' kinds and comments pass", () => {
  for (const source of [
    'import type { SpaceWords } from "../features/spaces/words";',
    "// A family's class says child; the caller decides.",
    '/* org.kind === "family" in a comment */',
    "const words: SpaceWords = props.words;",
    'const offline = error.kind === "network";',
    "const font = 'font-family';",
  ])
    assert.deepEqual(findings("ui/Widget.tsx", source), [], source);
});

/** A tiny source tree: a shared widget and what it imports. */
function tree(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "space-boundaries-"));
  for (const [path, source] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), source);
  }
  for (const path of [
    "features/spaces/resolve.ts",
    "features/spaces/useSpace.ts",
    "features/spaces/words.ts",
    "features/navigation/shell-frame.ts",
    "features/onboarding/guard.ts",
  ]) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    if (!files[path]) writeFileSync(join(root, path), "export const x = 1;\n");
  }
  return root;
}

test("imports: split, aliased, re-exported, dynamic or reached through another module", () => {
  for (const source of [
    'import { resolveSpace } from\n  "../features/spaces/resolve";',
    'import { resolveSpace as pick } from "../features/spaces/resolve";',
    'export * from "../features/spaces/resolve";',
    'export { useSpace } from "../features/spaces/useSpace";',
    'const load = () => import("../features/spaces/useSpace");',
    'import { shellFrame } from "../features/navigation/shell-frame";',
    'import { placesFor } from "../features/onboarding/guard";',
    // Words as a value: the widget would choose them.
    'import { spaceWords } from "../features/spaces/words";',
    // Through a helper that isn't shared.
    'import { helper } from "../lib/helper";',
  ]) {
    const root = tree({
      "ui/Widget.tsx": source,
      "lib/helper.ts":
        'import { useSpace } from "../features/spaces/useSpace";\nexport const helper = useSpace;\n',
    });
    assert.ok(
      reaches("ui/Widget.tsx", root).length > 0,
      `not caught: ${source}`,
    );
  }
  const root = tree({
    "ui/Widget.tsx":
      'import type { SpaceWords } from "../features/spaces/words";\nimport type { Thing } from "../features/onboarding/guard";\n',
  });
  assert.deepEqual(reaches("ui/Widget.tsx", root), []);
});

test("CP-2 r2 M2: a decision moved into a helper is still the widget's", () => {
  const root = tree({
    "ui/Widget.tsx":
      'import { label } from "../lib/helper";\nexport const Widget = () => label;\n',
    "lib/helper.ts":
      'export const label = (org: { kind: string }) => org.kind === "family" ? "child" : "student";\n',
  });
  const { found } = check(root);
  assert.ok(
    found.some((line) => line.includes("lib/helper.ts")),
    found.join("\n"),
  );
});
