import test from "node:test";
import assert from "node:assert/strict";
import { archetypes } from "../src/curriculum/archetypes";
import {
  archetypeAliases,
  canonicalArchetypeId,
} from "../src/curriculum/archetype-aliases";
import { buildReleasedItemLedger } from "../src/curriculum/released-items";
import { templateArchetypes } from "../src/curriculum/template-archetypes";

const live = new Set(archetypes.map((a) => a.id));

test("a merged archetype is gone and its target is live", () => {
  for (const [from, to] of Object.entries(archetypeAliases)) {
    assert.ok(
      !live.has(from),
      `${from} was merged into ${to} and must not be listed`,
    );
    assert.ok(live.has(to), `${to} must be a live archetype`);
    assert.equal(canonicalArchetypeId(from), to);
  }
  assert.equal(canonicalArchetypeId("measure.area"), "measure.area");
});

test("no ledger row or template link still names a merged archetype", () => {
  const dead = new Set(Object.keys(archetypeAliases));
  const report = buildReleasedItemLedger();
  for (const item of report.items)
    for (const id of item.archetypeIds)
      assert.ok(!dead.has(id), `${item.key} names merged archetype ${id}`);
  for (const [template, ids] of Object.entries(templateArchetypes))
    for (const id of ids)
      assert.ok(!dead.has(id), `${template} links merged archetype ${id}`);
});
