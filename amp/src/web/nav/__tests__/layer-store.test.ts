import { afterEach, expect, test } from "vitest";
import {
  layerActions,
  layerScope,
  pushed,
  seedLayers,
  useLayerStore,
} from "../layer-store";
import { legacyLayers, settleLegacyLayers, shareableHref } from "../links";

afterEach(() => useLayerStore.setState({ stacks: {}, motion: null }));

const skill = (id: string) => ({ kind: "skill" as const, id });
const map = "/family/f/kids/k/pathways";

test("a family's or a school's screen names its own account and learner; others are the account's", () => {
  expect(layerScope(`${map}/`, "parent")).toBe(map);
  // A child's session on the parent's device sees the parent's stack.
  expect(layerScope(map, "school:child")).toBe(map);
  expect(layerScope("/school/o/students", undefined)).toBe(
    "/school/o/students",
  );
  expect(layerScope("/pathways", "a")).toBe("a:/pathways");
  expect(layerScope("/pathways", "b")).not.toBe(layerScope("/pathways", "a"));
  expect(layerScope("/pathways", undefined)).toBe("guest:/pathways");
});

test("opening goes deeper; an open layer lower down brings the stack back to it", () => {
  const stack = [skill("a"), skill("b"), skill("c")];
  expect(pushed(stack, skill("d")).map((l) => l.id)).toEqual([
    "a",
    "b",
    "c",
    "d",
  ]);
  expect(pushed(stack, skill("b")).map((l) => l.id)).toEqual(["a", "b"]);
  expect(pushed(stack, skill("c"))).toEqual(stack);
});

test("a person's steps move the frame; a restored stack never does", () => {
  const layers = layerActions(map);
  layers.open(skill("a"));
  layers.open(skill("b"));
  layers.open(skill("c"));
  const state = () => useLayerStore.getState();
  expect(state().stacks[map]!.map((l) => l.id)).toEqual(["a", "b", "c"]);
  expect(state().motion).toMatchObject({ scope: map, direction: 1 });
  layers.close();
  expect(state().stacks[map]!.map((l) => l.id)).toEqual(["a", "b"]);
  expect(state().motion?.direction).toBe(-1);
  layers.closeToDepth(1);
  expect(state().stacks[map]!.map((l) => l.id)).toEqual(["a"]);
  layers.closeAll();
  expect(state().stacks[map]).toBeUndefined();
  const before = state().motion;
  seedLayers(map, [skill("x")]);
  expect(state().stacks[map]).toEqual([skill("x")]);
  expect(state().motion).toBe(before);
});

test("closing the overlay over an answer's replay goes back to the replay", () => {
  const layers = layerActions("/school/o/classes/c/map");
  layers.open([
    { kind: "student", id: "00000000-0000-4000-8000-000000000001" },
    {
      kind: "work",
      id: "00000000-0000-4000-8000-000000000001.abcdef01",
      skill: "angles",
    },
    { kind: "lesson", id: "angle-sums" },
  ]);
  layers.closeAll();
  expect(
    useLayerStore
      .getState()
      .stacks["/school/o/classes/c/map"]!.map((l) => l.kind),
  ).toEqual(["student", "work"]);
});

test("a link from before the store seeds it once and leaves the address", () => {
  const search = {
    open: "student:00000000-0000-4000-8000-000000000001,work:00000000-0000-4000-8000-000000000001.abcdef01",
    skill: "angles",
    sort: "name",
  };
  expect(legacyLayers(search).at(-1)).toMatchObject({ skill: "angles" });
  const settled = settleLegacyLayers(
    {
      pathname: "/school/o/students",
      search,
      searchStr: `?${new URLSearchParams(search)}`,
      hash: "",
    },
    "staff",
  )!;
  expect(settled.scope).toBe("/school/o/students");
  expect(settled.href).toBe("/school/o/students?sort=name");
  expect(settled.stack).toHaveLength(2);
  expect(
    settleLegacyLayers(
      {
        pathname: "/pathways",
        search: { view: "3d" },
        searchStr: "?view=3d",
        hash: "",
      },
      "a",
    ),
  ).toBeNull();
});

test("a layer's link shares the screen with its stack", () => {
  expect(
    shareableHref(map, "?view=3d&open=skill%3Aa", [skill("a"), skill("b")]),
  ).toBe(`${map}?view=3d&open=skill%3Aa%2Cskill%3Ab`);
  expect(shareableHref(map, "?view=3d", [])).toBe(`${map}?view=3d`);
});

test("closing an answer's replay closes back to the page, its student with it", () => {
  const scope = "/school/o/classes/c/map";
  const layers = layerActions(scope);
  layers.open([
    { kind: "student", id: "00000000-0000-4000-8000-000000000001" },
    { kind: "work", id: "00000000-0000-4000-8000-000000000001.abcdef01" },
  ]);
  layers.closeLayer(1);
  // One step: nothing of the stack is left to disagree with the page.
  expect(useLayerStore.getState().stacks[scope]).toBeUndefined();
});
