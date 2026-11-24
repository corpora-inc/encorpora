import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { skillCatalogOptions } from "../../../lib/learning-view";
import { sessionOptions } from "../../../lib/query";
import { LayerHost, openedFor } from "../../../nav/LayerHost";
import { useLayerStore } from "../../../nav/layer-store";
import { familyOptions, familyPlacesOptions } from "../../family/api";
import {
  CurriculumPractice,
  practiceChild,
  type OpenedFor,
} from "../CurriculumPractice";

/*
 * A practice control on a parent's screen starts practice for the child it
 * is about (QA 2026-11-23): the one its layer was opened for, whose answer
 * it sits over, or the page's own; never the learner last selected on the
 * device. Every name here is made up.
 */
const FAMILY = "4f1b61ea-bb9a-4e91-a1f6-8d9163354046";
const PIP = "ba306a0b-1299-40a6-8034-f42327610261";
const WREN = "06d07ec5-426f-427a-af88-7c202a88dc0c";
const THEO = "17d572cf-ba95-46d9-a493-31703be257b5";
const STRANGER = "9b2c7f10-5a43-4c1e-9d0f-3a1b2c3d4e5f";
const OWN = "c0ffee00-0000-4000-8000-00000000000a";
const person = (id: string) => `${id.slice(0, 24)}aaaaaaaaaaaa`;
const session = { accountId: "parent-1", token: "synthetic" };

const child = (id: string, name: string, can = true) => ({
  id,
  name,
  capabilities: { practiceHere: can },
  access: { canPractice: can },
  classes: [{ id: "class-1", personId: person(id) }],
});
const projection = {
  familyId: FAMILY,
  children: [
    child(PIP, "Pip"),
    child(WREN, "Wren"),
    child(THEO, "Theo", false),
  ],
};

/** The learner this device last selected is Pip, throughout. */
const view = vi.hoisted(() => ({ own: null as string | null }));
vi.mock("../../../lib/learning-view", async (original) => ({
  ...(await original<typeof import("../../../lib/learning-view")>()),
  useLearningView: () => ({
    session: { data: { accountId: "parent-1", token: "synthetic" } },
    account: {
      adultPractice: { learner: view.own ? { id: view.own } : null },
    },
    canPractice: true,
    viewOnly: false,
    learner: { id: "ba306a0b-1299-40a6-8034-f42327610261" },
  }),
}));
const handOver = vi.hoisted(() => vi.fn());
vi.mock("../../school/classes/today/use-hand-over", () => ({
  useHandOver: () => ({ handOver, starting: null, error: "" }),
}));
afterEach(() => {
  cleanup();
  places.families = [];
  view.own = null;
  handOver.mockReset();
  useLayerStore.setState({ stacks: {}, motion: null });
});
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const catalog = {
  skills: [
    {
      id: "angles",
      title: "Measuring angles",
      description: "About angles",
      gradeBand: "5",
      strand: "geometry",
      prerequisites: [],
    },
  ],
  templates: [
    { id: "angle-type", title: "Reading a protractor", skillId: "angles" },
  ],
};

/** The families this account is a parent of: none for a teacher. */
const places = { families: [] as unknown[] };
const CLASS = "f7b97235-d2d4-4d92-bb6b-6f338768a76a";
function renderAt(at: string, page: () => React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(familyPlacesOptions(session).queryKey, {
    families: places.families,
    next: null,
  } as never);
  client.setQueryData(sessionOptions.queryKey, session);
  client.setQueryData(skillCatalogOptions.queryKey, catalog as never);
  client.setQueryData(
    familyOptions(session, FAMILY).queryKey,
    projection as never,
  );
  const router = createRouter({
    routeTree: createRootRoute({ component: page }),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
const control =
  (opened?: OpenedFor, filter = { skill: "angles" }) =>
  () => <CurriculumPractice filter={filter} opened={opened} />;
const today = `/family/${FAMILY}`;
/** The control, once the screen has drawn; null when none is offered. */
async function offered() {
  await screen.findByTestId("drawn");
  return document.querySelector<HTMLElement>(
    "[data-curriculum-practice] button, a[data-curriculum-practice]",
  );
}
const drawn = (page: () => React.ReactNode) => () => (
  <>
    {page()}
    <span data-testid="drawn" />
  </>
);

test("the child a control starts: their answer, then their layer, then their page; never a guess", () => {
  const kids = projection.children;
  // Nobody named: nobody's child (the adult's own).
  expect(practiceChild(kids, {})).toBeUndefined();
  expect(practiceChild(kids, { learner: WREN })?.name).toBe("Wren");
  expect(practiceChild(kids, { addressed: PIP })?.name).toBe("Pip");
  // A layer opened for one child over another's page is the layer's child.
  expect(practiceChild(kids, { learner: WREN, addressed: PIP })?.name).toBe(
    "Wren",
  );
  // An answer is its own child's, by their roster person.
  expect(
    practiceChild(kids, { person: person(THEO), addressed: PIP })?.name,
  ).toBe("Theo");
  // Named, and not the family's: nobody, never a fallback.
  expect(practiceChild(kids, { learner: STRANGER })).toBeNull();
  expect(practiceChild(kids, { learner: STRANGER, addressed: PIP })).toBeNull();
  expect(practiceChild(kids, { person: person(STRANGER) })).toBeNull();
  expect(practiceChild(kids, { addressed: STRANGER })).toBeNull();
  expect(practiceChild([], { learner: WREN })).toBeNull();
});

test("a layer says whose it is: the learner it was opened for, else the answer under it", () => {
  const answer = { kind: "work" as const, id: `${person(WREN)}.abcdef01` };
  expect(openedFor({ kind: "skill", id: "angles", for: WREN }, [])).toEqual({
    learner: WREN,
  });
  expect(openedFor({ kind: "lesson", id: "angle-type" }, [answer])).toEqual({
    person: person(WREN),
  });
  // Its own name is nearer than an answer further down.
  expect(
    openedFor({ kind: "lesson", id: "angle-type", for: PIP }, [answer]),
  ).toEqual({ learner: PIP });
  // A record under it names its person, as an answer does; the nearest.
  const record = { kind: "student" as const, id: person(PIP) };
  expect(openedFor({ kind: "skill", id: "angles" }, [record])).toEqual({
    person: person(PIP),
  });
  expect(
    openedFor({ kind: "lesson", id: "angle-type" }, [record, answer]),
  ).toEqual({ person: person(WREN) });
  expect(openedFor({ kind: "skill", id: "angles" }, [])).toBeUndefined();
  expect(
    openedFor({ kind: "skill", id: "angles" }, [
      { kind: "skill", id: "fractions" },
    ]),
  ).toBeUndefined();
});

test("over Today, a skill opened from Wren's block practices with Wren, whoever is selected", async () => {
  const router = renderAt(today, drawn(control({ learner: WREN })));
  const button = (await offered())!;
  expect(button.getAttribute("aria-label")).toBe(
    "Practice Measuring angles with Wren",
  );
  fireEvent.click(button);
  expect(handOver).toHaveBeenCalledTimes(1);
  expect(handOver).toHaveBeenCalledWith(
    WREN,
    { skill: "angles" },
    router.state.location.href,
  );
});

test("a lesson and an area name what they practice, and whose", async () => {
  renderAt(
    today,
    drawn(
      control({ learner: PIP }, {
        skill: "angles",
        template: "angle-type",
      } as never),
    ),
  );
  expect((await offered())!.getAttribute("aria-label")).toBe(
    "Practice Reading a protractor with Pip",
  );
  cleanup();
  renderAt(
    today,
    drawn(control({ learner: WREN }, { strand: "geometry" } as never)),
  );
  expect((await offered())!.getAttribute("aria-label")).toBe(
    "Practice Geometry with Wren",
  );
});

test("the layer host hands its layer's learner to the control (a shared link, a reload)", async () => {
  renderAt(
    `${today}?open=skill%3Aangles&for=${WREN}`,
    drawn(() => <LayerHost />),
  );
  const button = await screen.findByRole("button", {
    name: "Practice Measuring angles with Wren",
  });
  fireEvent.click(button);
  expect(handOver.mock.calls[0]!.slice(0, 2)).toEqual([
    WREN,
    { skill: "angles" },
  ]);
});

test("over an answer, its lesson practices with the child whose answer it is", async () => {
  renderAt(today, drawn(control({ person: person(WREN) })));
  fireEvent.click((await offered())!);
  expect(handOver.mock.calls[0]![0]).toBe(WREN);
});

test("a learner who isn't the family's, named by an edited address, gets no control", async () => {
  for (const opened of [
    { learner: STRANGER },
    { person: person(STRANGER) },
    // The adult's own learner is nobody's child either.
    { learner: OWN },
  ]) {
    view.own = OWN;
    renderAt(today, drawn(control(opened)));
    expect(await offered()).toBeNull();
    cleanup();
  }
  // Over a child's own page too: the named learner is never swapped for
  // the page's.
  renderAt(`${today}/kids/${PIP}`, drawn(control({ learner: STRANGER })));
  expect(await offered()).toBeNull();
  expect(handOver).not.toHaveBeenCalled();
});

test("a child who can't practice here has no control (never a button that fails)", async () => {
  renderAt(today, drawn(control({ learner: THEO })));
  expect(await offered()).toBeNull();
  cleanup();
  renderAt(`${today}/kids/${THEO}`, drawn(control()));
  expect(await offered()).toBeNull();
});

test("a child's own page, and every screen under it, practices with that child", async () => {
  for (const leaf of ["", "/pathways", "/inventory", "/workbooks/2026-11-23"]) {
    renderAt(`${today}/kids/${WREN}${leaf}`, drawn(control()));
    const button = (await offered())!;
    // The page is one child's: its name stays as it was.
    expect(button.getAttribute("aria-label")).toBe("Practice with Wren");
    fireEvent.click(button);
    expect(handOver.mock.calls.at(-1)![0]).toBe(WREN);
    cleanup();
  }
});

test("a family's screen that names no child offers the adult's own practice, or none", async () => {
  // Pip is the learner selected on this device: never theirs by that.
  renderAt(today, drawn(control()));
  expect(await offered()).toBeNull();
  cleanup();
  view.own = OWN;
  renderAt(today, drawn(control()));
  const link = (await offered())!;
  expect(link.tagName).toBe("A");
  expect(link.getAttribute("href")).toBe(`/practice/${OWN}/skills/angles`);
  expect(link.getAttribute("data-practice-for")).toBe("self");
  expect(handOver).not.toHaveBeenCalled();
});

test("in a class nobody answers as a student, whoever the layer names", async () => {
  // A teacher: no family of their own here.
  for (const opened of [
    { learner: WREN },
    { person: person(WREN) },
    undefined,
  ]) {
    renderAt(`/school/o/classes/${CLASS}/today`, drawn(control(opened)));
    expect(await offered()).toBeNull();
    cleanup();
  }
  // A co-teacher of a family's class is staff there, not a parent.
  places.families = [{ familyId: FAMILY, classId: CLASS, role: "co-teacher" }];
  renderAt(
    `/school/o/classes/${CLASS}/today`,
    drawn(control({ person: person(WREN) })),
  );
  expect(await offered()).toBeNull();
  expect(handOver).not.toHaveBeenCalled();
});

test("in their family's own class, over their own child's record, a parent starts that child's practice", async () => {
  places.families = [{ familyId: FAMILY, classId: CLASS, role: "holder" }];
  const at = `/school/o/classes/${CLASS}/today`;
  renderAt(at, drawn(control({ person: person(WREN) })));
  const button = (await offered())!;
  expect(button.getAttribute("aria-label")).toBe(
    "Practice Measuring angles with Wren",
  );
  fireEvent.click(button);
  expect(handOver.mock.calls[0]!.slice(0, 2)).toEqual([
    WREN,
    { skill: "angles" },
  ]);
  cleanup();
  // Another family's child in the same class, a learner named by an edited
  // address, the class's own skill, and any other class: nothing.
  for (const [path, opened] of [
    [at, { person: person(STRANGER) }],
    [at, { learner: WREN }],
    [at, undefined],
    ["/school/o/classes/another-class/today", { person: person(WREN) }],
    ["/school/o/students", { person: person(WREN) }],
  ] as const) {
    renderAt(path, drawn(control(opened)));
    expect(await offered()).toBeNull();
    cleanup();
  }
  // A child who can't practice here has no control in the class either.
  renderAt(at, drawn(control({ person: person(THEO) })));
  expect(await offered()).toBeNull();
  expect(handOver).toHaveBeenCalledTimes(1);
});

test("own practice starts directly, at the learner's own address", async () => {
  renderAt("/inventory", drawn(control()));
  const link = (await offered())!;
  expect(link.getAttribute("href")).toBe(`/practice/${PIP}/skills/angles`);
});
