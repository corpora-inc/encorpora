import assert from "node:assert/strict";
import test from "node:test";
import { templates } from "../src/math/engine";
import {
  uiSweepManifest,
  uiSweepPartition,
} from "../scripts/ui-sweep-partition";

const inventory = templates.map((template) => template.id);
test("eight UI lanes cover the complete live inventory exactly once", () => {
  const completed: string[] = [];
  for (let index = 0; index < 8; index++) {
    const partition = uiSweepPartition(inventory, {
      AMP_UI_SHARD_INDEX: String(index),
      AMP_UI_SHARD_COUNT: "8",
    });
    assert.deepEqual(
      partition.selectedIds,
      inventory.filter((_, i) => i % 8 === index),
    );
    const manifest = uiSweepManifest(inventory, partition, [
      ...partition.selectedIds,
    ]);
    assert.equal(manifest.shardIndex, index);
    assert.equal(manifest.shardCount, 8);
    assert.deepEqual(manifest.inventoryIds, inventory);
    completed.push(...manifest.completedIds);
  }
  assert.equal(completed.length, inventory.length);
  assert.equal(new Set(completed).size, inventory.length);
  assert.deepEqual([...completed].sort(), [...inventory].sort());
});
test("default UI sweep is complete and broad lane skip is explicit", () => {
  assert.deepEqual(uiSweepPartition(inventory, {}).selectedIds, inventory);
  const skipped = uiSweepPartition(inventory, {
    AMP_UI_SKIP_TEMPLATE_SWEEP: "1",
  });
  assert.deepEqual(skipped.selectedIds, []);
  assert.throws(() => uiSweepManifest(inventory, skipped, []));
});
test("invalid partitions and incomplete evidence fail closed", () => {
  for (const env of [
    { AMP_UI_SHARD_INDEX: "0" },
    { AMP_UI_SHARD_COUNT: "8" },
    { AMP_UI_SHARD_INDEX: "0", AMP_UI_SHARD_COUNT: "0" },
    { AMP_UI_SHARD_INDEX: "8", AMP_UI_SHARD_COUNT: "8" },
    { AMP_UI_SHARD_INDEX: "-1", AMP_UI_SHARD_COUNT: "8" },
    { AMP_UI_SHARD_INDEX: "1.5", AMP_UI_SHARD_COUNT: "8" },
    { AMP_UI_SHARD_INDEX: "0", AMP_UI_SHARD_COUNT: "999999" },
    {
      AMP_UI_SHARD_INDEX: "0",
      AMP_UI_SHARD_COUNT: "8",
      AMP_UI_SKIP_TEMPLATE_SWEEP: "1",
    },
    { AMP_UI_SKIP_TEMPLATE_SWEEP: "0" },
  ])
    assert.throws(() => uiSweepPartition(inventory, env));
  assert.throws(() => uiSweepPartition([], {}));
  assert.throws(() => uiSweepPartition(["duplicate", "duplicate"], {}));
  const partition = uiSweepPartition(inventory, {});
  assert.throws(() =>
    uiSweepManifest(inventory, partition, inventory.slice(1)),
  );
  assert.throws(() =>
    uiSweepManifest(inventory, partition, [...inventory, inventory[0]!]),
  );
  assert.throws(() =>
    uiSweepManifest(inventory, partition, [...inventory].reverse()),
  );
});
