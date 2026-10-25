import test from "node:test";
import assert from "node:assert/strict";
import {
  hasPurchaseReturn,
  parsePurchaseReturn,
  purchaseReturnSlot,
} from "../src/web/purchase-return.js";
const now = 1_800_000_000_000;
const purchaseId = "a0000000-0000-4000-8000-000000000001";
test("purchase return is a bounded navigation hint, without authority fields", () => {
  for (const state of ["processing", "canceled"] as const) {
    const entry = { state, purchaseId, expiresAt: now + 60_000 };
    assert.deepEqual(parsePurchaseReturn(entry, now), entry);
    assert.equal(parsePurchaseReturn({ ...entry, paid: true }, now), null);
    assert.equal(
      parsePurchaseReturn({ ...entry, learnerId: "child" }, now),
      null,
    );
    assert.equal(
      parsePurchaseReturn({ ...entry, purchaseId: "../other" }, now),
      null,
    );
    assert.equal(parsePurchaseReturn({ ...entry, expiresAt: now }, now), null);
    assert.equal(
      parsePurchaseReturn({ ...entry, expiresAt: now + 900_001 }, now),
      null,
    );
    assert.equal(parsePurchaseReturn({ ...entry, state: "paid" }, now), null);
    assert.equal(parsePurchaseReturn({ ...entry, state: [state] }, now), null);
  }
  assert.ok(parsePurchaseReturn({ state: "account", expiresAt: now + 1 }, now));
  assert.equal(
    parsePurchaseReturn(
      { state: "account", purchaseId, expiresAt: now + 1 },
      now,
    ),
    null,
  );
  assert.equal(
    parsePurchaseReturn({ state: "processing", expiresAt: now + 1 }, now),
    null,
  );
});

test("entry routing recognizes payment handoffs without consuming them", () => {
  const saved = { state: "processing", purchaseId, expiresAt: now + 60_000 };
  let raw: string | null = JSON.stringify(saved);
  const original = Object.getOwnPropertyDescriptor(
    globalThis,
    "sessionStorage",
  );
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem(key: string) {
        assert.equal(key, purchaseReturnSlot);
        return raw;
      },
      setItem() {
        throw new Error("Entry routing must not consume a return");
      },
      removeItem() {
        throw new Error("Entry routing must not consume a return");
      },
    },
  });
  try {
    assert.equal(hasPurchaseReturn("", now), true);
    assert.equal(raw, JSON.stringify(saved));
    assert.equal(
      hasPurchaseReturn(`?billing=canceled&purchase=${purchaseId}`, now),
      true,
    );
    assert.equal(hasPurchaseReturn("?billing=account", now), true);
    assert.equal(
      hasPurchaseReturn("?billing=processing&purchase=invalid", now),
      false,
    );
    raw = JSON.stringify({ ...saved, expiresAt: now });
    assert.equal(hasPurchaseReturn("", now), false);
    raw = "not json";
    assert.equal(hasPurchaseReturn("", now), false);
  } finally {
    if (original) Object.defineProperty(globalThis, "sessionStorage", original);
    else Reflect.deleteProperty(globalThis, "sessionStorage");
  }
});
