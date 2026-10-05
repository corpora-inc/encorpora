import assert from "node:assert/strict";
import { test } from "node:test";
import { hapticsEnabled, isMilestone, setHapticsEnabled, streakLevel } from "./celebrate";

test("celebration escalates gently at three and five in a row", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(streakLevel), [0, 0, 0, 1, 1, 2, 2]);
  assert.deepEqual([1, 2, 3, 4, 5, 6, 10, 15, 16].filter(isMilestone), [3, 5, 10, 15]);
});

test("haptics default on, persist off and on, and survive a broken store", () => {
  const map = new Map<string, string>();
  const store = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
  assert.equal(hapticsEnabled(store), true);
  setHapticsEnabled(false, store);
  assert.equal(hapticsEnabled(store), false);
  setHapticsEnabled(true, store);
  assert.equal(hapticsEnabled(store), true);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(hapticsEnabled(broken), true);
    assert.doesNotThrow(() => setHapticsEnabled(false, broken));
  } finally {
    console.warn = warn;
  }
});
