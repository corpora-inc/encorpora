import { test } from "node:test";
import assert from "node:assert/strict";
import { pathOrder } from "./order.ts";

const node = (node_id: string, kind: string) => ({ node_id, kind }) as never;
const edge = (from_node: string, to_node: string, ord = 0) => ({ from_node, to_node, ord, label: "", cond: null, retry: false }) as never;

test("the entry comes first even when storage sorts it last (the real pre-arm pack)", () => {
  const t = { tree: { entry_node: "t.sy" }, nodes: [node("t.r1a1", "action"), node("t.sy", "symptom")], edges: [edge("t.sy", "t.r1a1")] };
  assert.deepEqual(pathOrder(t).map((n: { node_id: string }) => n.node_id), ["t.sy", "t.r1a1"]);
});

test("branches in the manual's order, breadth-first; a loop back and unreached nodes do not repeat", () => {
  const t = {
    tree: { entry_node: "a" },
    nodes: [node("z", "end"), node("c", "action"), node("b", "check"), node("a", "symptom"), node("orphan", "end")],
    edges: [edge("a", "b"), edge("b", "z", 2), edge("b", "c", 1), edge("c", "b"), edge("c", "a")],
  };
  assert.deepEqual(pathOrder(t).map((n: { node_id: string }) => n.node_id), ["a", "b", "c", "z", "orphan"]);
});

test("every tree is grouped, even when the pack lists no systems", async () => {
  const { bySystem } = await import("./order.ts");
  const trees = [{ id: 1, system: null }, { id: 2, system: "cooling" }, { id: 3, system: "starting" }, { id: 4, system: null }];
  assert.deepEqual(
    bySystem([], trees).map((g) => [g.system, g.trees.map((t) => t.id)]),
    [["cooling", [2]], ["starting", [3]], ["", [1, 4]]],
  );
  assert.deepEqual(bySystem(["starting"], trees).map((g) => g.system), ["starting", "cooling", ""]);
});
