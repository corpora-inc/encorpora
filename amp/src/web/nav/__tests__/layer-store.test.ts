import { afterEach, expect, test } from "vitest";
import {
  layerActions,
  layerScope,
  pathwaysSkill,
  pushed,
  seedLayers,
  swapped,
  useLayerStore,
  type Layer,
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

test("your own map names an open skill in its path, and that address is the map's screen", () => {
  expect(pathwaysSkill("/pathways/count-to-20")).toBe("count-to-20");
  expect(pathwaysSkill("/pathways/count-to-20/")).toBe("count-to-20");
  expect(pathwaysSkill("/pathways")).toBeUndefined();
  expect(pathwaysSkill("/pathways/a/b")).toBeUndefined();
  expect(pathwaysSkill(`${map}/s1`)).toBeUndefined();
  // A malformed address is no skill, never an error.
  expect(pathwaysSkill("/pathways/%E0%A4%A")).toBeUndefined();
  // Its view and its layers are the map's, whichever skill is open.
  expect(layerScope("/pathways/count-to-20", "a")).toBe("a:/pathways");
  expect(layerScope("/pathways/arrays", undefined)).toBe("guest:/pathways");
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

// ---- whose a layer was opened for (`?for=`) --------------------------------
const WREN = "06d07ec5-426f-427a-af88-7c202a88dc0c";
const PIP = "ba306a0b-1299-40a6-8034-f42327610261";
const today = "/family/4f1b61ea-bb9a-4e91-a1f6-8d9163354046";
const searchOf = (href: string) =>
  Object.fromEntries(new URL(href, "https://amp.invalid").searchParams);

test("a layer's link names whose it is, and the address gives the same stack back", () => {
  const stack: Layer[] = [
    { kind: "skill", id: "fractions", for: WREN },
    { kind: "lesson", id: "a-type", for: WREN },
  ];
  const href = shareableHref(today, "", stack);
  expect(href).toBe(
    `${today}?open=skill%3Afractions%2Clesson%3Aa-type&for=${WREN}`,
  );
  expect(legacyLayers(searchOf(href))).toEqual(stack);
  // One layer or several, a skill, a lesson or an area: the same round trip.
  for (const one of [
    [{ kind: "skill", id: "fractions", for: PIP }],
    [{ kind: "lesson", id: "a-type", for: PIP }],
    [{ kind: "area", id: "geometry", for: PIP }],
    [
      { kind: "area", id: "overall", for: WREN },
      { kind: "skill", id: "angles", for: WREN },
      { kind: "lesson", id: "an-angle-type", for: WREN },
    ],
  ] as Layer[][])
    expect(
      legacyLayers(searchOf(shareableHref(today, "?view=3d", one))),
    ).toEqual(one);
  // Nobody named: no key, and none read.
  const plain: Layer[] = [{ kind: "skill", id: "fractions" }];
  expect(shareableHref(today, "", plain)).toBe(
    `${today}?open=skill%3Afractions`,
  );
  expect(legacyLayers(searchOf(shareableHref(today, "", plain)))).toEqual(
    plain,
  );
  // A link built on an address that still names someone names only its own.
  expect(shareableHref(today, `?for=${PIP}`, plain)).toBe(
    `${today}?open=skill%3Afractions`,
  );
  expect(shareableHref(today, `?for=${PIP}`, stack)).toContain(`for=${WREN}`);
  expect(shareableHref(today, `?for=${PIP}`, stack)).not.toContain(PIP);
});

test("an address names a learner only by a well-formed id, and only on layers that read one", () => {
  const person = "00000000-0000-4000-8000-000000000001";
  for (const bad of ["pip", "", `${WREN}x`, "../kids/1", "<script>"])
    expect(legacyLayers({ open: "skill:fractions", for: bad })).toEqual([
      { kind: "skill", id: "fractions" },
    ]);
  expect(legacyLayers({ open: "skill:fractions", for: [WREN] })).toEqual([
    { kind: "skill", id: "fractions" },
  ]);
  // A student's record and an answer are their own; the lesson over them
  // takes the name.
  expect(
    legacyLayers({
      open: `student:${person},work:${person}.abcdef01,lesson:a-type`,
      for: WREN,
    }),
  ).toEqual([
    { kind: "student", id: person },
    { kind: "work", id: `${person}.abcdef01` },
    { kind: "lesson", id: "a-type", for: WREN },
  ]);
  // No layers: nobody is named for nothing.
  expect(legacyLayers({ for: WREN })).toEqual([]);
});

test("a shared link's learner moves into the store with its layers and leaves the address", () => {
  const search = { open: "skill:fractions", for: WREN, sort: "name" };
  const settled = settleLegacyLayers(
    {
      pathname: today,
      search,
      searchStr: `?${new URLSearchParams(search)}`,
      hash: "",
    },
    "parent",
  )!;
  expect(settled.href).toBe(`${today}?sort=name`);
  expect(settled.stack).toEqual([
    { kind: "skill", id: "fractions", for: WREN },
  ]);
  seedLayers(settled.scope, settled.stack);
  expect(useLayerStore.getState().stacks[today]).toEqual(settled.stack);
});

test("what opens over a child's layer is that child's; its own name wins; closing leaves nothing", () => {
  const first: Layer = { kind: "skill", id: "fractions", for: WREN };
  // A lesson over the skill, a connected skill, an area's skill.
  expect(pushed([first], { kind: "lesson", id: "a-type" })).toEqual([
    first,
    { kind: "lesson", id: "a-type", for: WREN },
  ]);
  expect(pushed([first], skill("decimals")).at(-1)).toEqual({
    kind: "skill",
    id: "decimals",
    for: WREN,
  });
  // A layer opened for someone by name keeps that name.
  expect(
    pushed([first], { kind: "skill", id: "decimals", for: PIP }).at(-1)?.for,
  ).toBe(PIP);
  // Previous and Next, one area for another: still theirs.
  expect(
    swapped([{ kind: "area", id: "geometry", for: WREN }], {
      kind: "area",
      id: "algebra",
    }),
  ).toEqual([{ kind: "area", id: "algebra", for: WREN }]);
  // An answer is its own student's: it takes nobody's name.
  const person = "00000000-0000-4000-8000-000000000001";
  expect(
    pushed([first], { kind: "work", id: `${person}.abcdef01` }).at(-1),
  ).toEqual({ kind: "work", id: `${person}.abcdef01` });
  // Nobody named below: nobody named above.
  expect(pushed([skill("a")], skill("b"))).toEqual([skill("a"), skill("b")]);

  const layers = layerActions(today);
  layers.open(first);
  layers.open({ kind: "lesson", id: "a-type" });
  const stored = () => useLayerStore.getState().stacks[today];
  expect(stored()).toEqual([
    first,
    { kind: "lesson", id: "a-type", for: WREN },
  ]);
  layers.replaceTop({ kind: "lesson", id: "b-type" });
  expect(stored()!.at(-1)).toEqual({ kind: "lesson", id: "b-type", for: WREN });
  layers.closeAll();
  expect(stored()).toBeUndefined();
  expect(JSON.stringify(useLayerStore.getState().stacks)).not.toContain(WREN);
  // The same skill from another child's block is that child's, not the last.
  layers.open({ kind: "skill", id: "fractions", for: PIP });
  expect(stored()).toEqual([{ kind: "skill", id: "fractions", for: PIP }]);
});

test("the store keeps a learner only as a well-formed id on a layer that reads one", () => {
  const person = "00000000-0000-4000-8000-000000000001";
  seedLayers(today, [
    { kind: "skill", id: "fractions", for: "not-an-id" },
    { kind: "work", id: `${person}.abcdef01`, for: WREN } as Layer,
    { kind: "lesson", id: "a-type", for: WREN },
  ]);
  expect(useLayerStore.getState().stacks[today]).toEqual([
    { kind: "skill", id: "fractions" },
    { kind: "work", id: `${person}.abcdef01` },
    { kind: "lesson", id: "a-type", for: WREN },
  ]);
});
