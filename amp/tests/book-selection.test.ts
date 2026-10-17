import assert from "node:assert/strict";
import test from "node:test";
import { preferredBookForProblem } from "../src/books/selection.js";
test("an exact template binding outranks an earlier book sharing the skill", () => {
  const earlier = {
    id: "general",
    skills: ["rectangle-area"],
    templates: ["another-area-family"],
  };
  const exact = {
    id: "equal-groups",
    skills: ["rectangle-area"],
    templates: ["rectangle-area"],
  };
  assert.equal(
    preferredBookForProblem([earlier, exact], {
      templateId: "rectangle-area",
      skillId: "rectangle-area",
    }),
    exact,
  );
  assert.equal(
    preferredBookForProblem([exact, earlier], {
      templateId: "rectangle-area",
      skillId: "rectangle-area",
    }),
    exact,
  );
});
test("selection falls back to skill and preserves catalog order without mutating summaries", () => {
  const books = Object.freeze([
    Object.freeze({
      id: "first",
      skills: Object.freeze(["division-facts"]),
      templates: Object.freeze([] as string[]),
    }),
    Object.freeze({
      id: "second",
      skills: Object.freeze(["division-facts"]),
      templates: Object.freeze([] as string[]),
    }),
  ]);
  assert.equal(
    preferredBookForProblem(books, {
      templateId: "unbound",
      skillId: "division-facts",
    }),
    books[0],
  );
  assert.equal(
    preferredBookForProblem(books, {
      templateId: "unbound",
      skillId: "absent",
    }),
    undefined,
  );
  assert.equal(
    preferredBookForProblem([], {
      templateId: "unbound",
      skillId: "division-facts",
    }),
    undefined,
  );
});
