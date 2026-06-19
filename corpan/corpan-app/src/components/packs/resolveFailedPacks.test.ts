import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveFailedPacks } from "./resolveFailedPacks.ts";

type Pack = { id: string; name: string };

function makeCatalog(packs: Pack[]) {
    const map = new Map(packs.map((p) => [p.id, p]));
    return (id: string) => map.get(id);
}

test("returns [] for no failed ids", () => {
    const byId = makeCatalog([{ id: "a", name: "A" }]);
    assert.deepEqual(resolveFailedPacks([], byId, () => false), []);
});

test("resolves failed ids to live pack objects from the full catalog", () => {
    // Catalog holds packs that are NOT in any 'current view' — retry must
    // still find them by id.
    const byId = makeCatalog([
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
    ]);
    const resolved = resolveFailedPacks(["a", "c"], byId, () => false);
    assert.deepEqual(
        resolved.map((p) => p.id),
        ["a", "c"],
    );
});

test("skips ids that have since been installed elsewhere", () => {
    const byId = makeCatalog([
        { id: "a", name: "A" },
        { id: "b", name: "B" },
    ]);
    const installed = new Set(["a"]);
    const resolved = resolveFailedPacks(["a", "b"], byId, (id) =>
        installed.has(id),
    );
    assert.deepEqual(
        resolved.map((p) => p.id),
        ["b"],
    );
});

test("skips ids that no longer resolve in the catalog", () => {
    const byId = makeCatalog([{ id: "a", name: "A" }]);
    const resolved = resolveFailedPacks(["a", "gone"], byId, () => false);
    assert.deepEqual(
        resolved.map((p) => p.id),
        ["a"],
    );
});

test("empties when every failed pack is now installed (clears dead affordance)", () => {
    const byId = makeCatalog([
        { id: "a", name: "A" },
        { id: "b", name: "B" },
    ]);
    const installed = new Set(["a", "b"]);
    const resolved = resolveFailedPacks(["a", "b"], byId, (id) =>
        installed.has(id),
    );
    assert.deepEqual(resolved, []);
});

test("preserves failed-id order", () => {
    const byId = makeCatalog([
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
    ]);
    const resolved = resolveFailedPacks(["c", "a", "b"], byId, () => false);
    assert.deepEqual(
        resolved.map((p) => p.id),
        ["c", "a", "b"],
    );
});
