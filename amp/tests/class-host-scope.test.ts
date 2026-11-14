import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  keptPerson,
  offersWholeClass,
  wholeClass,
} from "../src/web/features/school/classes/host-scope.js";

/*
 * A family's records composed over its class (CP-4 H1): a person the family
 * doesn't show never opens from an address, and nothing that acts on the
 * whole class (export, closing a term, the curve) is offered where the
 * class also holds other families' children.
 */

const OWN = "00000000-0000-4000-8000-0000000000a1";
const HOSTED = "00000000-0000-4000-8000-0000000000b1";
const family = {
  keep: (person: string) => person === OWN,
  shared: true,
};

test("a person outside the family never opens, whatever the address says", () => {
  assert.equal(keptPerson(family, HOSTED), undefined);
  assert.equal(keptPerson(family, OWN), OWN);
  assert.equal(keptPerson(family, null), undefined);
  // The class itself shows everyone.
  assert.equal(keptPerson({}, HOSTED), HOSTED);
});

test("a shared class offers no whole-class action to the family", () => {
  assert.equal(offersWholeClass(family), false);
  assert.equal(wholeClass(family, 1, 2), false);
  // Even if every row happened to be shown, the class is shared.
  assert.equal(wholeClass(family, 2, 2), false);
});

test("a family's own class offers them only when every row is shown", () => {
  const own = { keep: (person: string) => person === OWN, shared: false };
  assert.equal(wholeClass(own, 1, 1), true);
  // A row the family doesn't show: the counts would lie, so nothing is
  // offered.
  assert.equal(wholeClass(own, 1, 2), false);
  // The class at its own address.
  assert.equal(wholeClass({}, 20, 20), true);
});

test("the gradebook and report cards gate on these rules", () => {
  const book = readFileSync(
    new URL(
      "../src/web/features/school/classes/GradebookScreen.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  // The requested person goes through the host's filter.
  assert.match(
    book,
    /const open = keptPerson\(host, uuidOr\(search\.student\)\)/,
  );
  // Export, Close term, the curve and its sheet each wait on `whole`.
  assert.match(
    book,
    /\{whole && \(\s*<Button variant="quiet" onClick=\{\(\) => set\(\{ export: 1 \}\)\}>/,
  );
  assert.match(book, /\{editable && whole && \(/);
  assert.match(book, /\{curved && editable && whole && \(/);
  assert.match(book, /\{whole && \(\s*<ExportSheet/);
  // A shared link to Close term never opens its dialog in a shared host.
  assert.match(book, /search\.close === "1"\) &&\s*offersWholeClass\(host\)/);
  const cards = readFileSync(
    new URL(
      "../src/web/features/school/classes/ReportCardScreen.tsx",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(
    cards,
    /const only = keptPerson\(host, uuidOr\(search\.student\)\)/,
  );
});
