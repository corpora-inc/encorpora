import assert from "node:assert/strict";

/** Each inventory position belongs to exactly one modulo partition. */
export function uiSweepPartition(
  inventoryIds: readonly string[],
  env: Record<string, string | undefined> = process.env,
) {
  assert.ok(inventoryIds.length > 0, "UI sweep inventory is empty");
  assert.equal(
    new Set(inventoryIds).size,
    inventoryIds.length,
    "Duplicate UI template IDs",
  );
  const rawIndex = env.AMP_UI_SHARD_INDEX;
  const rawCount = env.AMP_UI_SHARD_COUNT;
  const skip = env.AMP_UI_SKIP_TEMPLATE_SWEEP;
  assert.ok(
    skip === undefined || skip === "1",
    "AMP_UI_SKIP_TEMPLATE_SWEEP must be 1 or unset",
  );
  assert.equal(
    rawIndex === undefined,
    rawCount === undefined,
    "Both UI shard variables are required",
  );
  assert.ok(
    !(skip && rawIndex !== undefined),
    "Cannot skip a sharded UI sweep",
  );
  const integer = (value: string, name: string) => {
    assert.match(
      value,
      /^(0|[1-9][0-9]*)$/,
      `${name} must be a nonnegative integer`,
    );
    const number = Number(value);
    assert.ok(
      Number.isSafeInteger(number),
      `${name} exceeds the safe integer range`,
    );
    return number;
  };
  const shardIndex = integer(rawIndex ?? "0", "AMP_UI_SHARD_INDEX");
  const shardCount = integer(rawCount ?? "1", "AMP_UI_SHARD_COUNT");
  assert.ok(
    shardCount > 0 && shardCount <= inventoryIds.length,
    "UI shard count must be between 1 and the inventory size",
  );
  assert.ok(
    shardIndex < shardCount,
    "UI shard index must be below the shard count",
  );
  const selectedIds = skip
    ? []
    : inventoryIds.filter((_, index) => index % shardCount === shardIndex);
  return { shardIndex, shardCount, selectedIds, skip: skip === "1" };
}

export function uiSweepManifest(
  inventoryIds: readonly string[],
  partition: ReturnType<typeof uiSweepPartition>,
  completedIds: readonly string[],
) {
  assert.ok(!partition.skip, "A skipped sweep cannot emit completion evidence");
  assert.deepEqual(
    completedIds,
    partition.selectedIds,
    "UI sweep did not complete its exact partition",
  );
  return {
    version: 1,
    shardIndex: partition.shardIndex,
    shardCount: partition.shardCount,
    inventoryIds,
    completedIds,
  };
}
