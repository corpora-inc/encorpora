import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { familyOptions } from "../../features/family/api";
import { skillCatalogOptions } from "../../lib/learning-view";
import { sessionOptions } from "../../lib/query";
import { areaSourceOf } from "../AreaLayer";
import { workbookDay } from "../entities";
import { LayerHost } from "../LayerHost";
import { layerScope, seedLayers, useLayerStore } from "../layer-store";

/*
 * The workbook maker as a layer: over the layer it was opened from, on the
 * screen that layer is open on. ✕ puts it down to that layer; the screen
 * behind and its address never change. Every name here is made up.
 */
const FAMILY = "4f1b61ea-bb9a-4e91-a1f6-8d9163354046";
const WREN = "06d07ec5-426f-427a-af88-7c202a88dc0c";
const PIP = "ba306a0b-1299-40a6-8034-f42327610261";
const STRANGER = "9b2c7f10-5a43-4c1e-9d0f-3a1b2c3d4e5f";
const session = { accountId: "parent-1", token: "synthetic" };
const DAY = "2026-11-24";

vi.mock("../../lib/learning-view", async (original) => ({
  ...(await original<typeof import("../../lib/learning-view")>()),
  useLearningView: () => ({
    session: { data: { accountId: "parent-1", token: "synthetic" } },
    account: {
      account: { kind: "adult" },
      family: {
        learners: [WREN, PIP].map((id) => ({
          id,
          name: id === WREN ? "Wren" : "Pip",
          deletedAt: null,
          learningAllowed: true,
          hasAccess: true,
        })),
      },
    },
    canPractice: false,
    viewOnly: false,
    learner: null,
  }),
}));
// The maker itself is not this test's: who it is for, and the day.
vi.mock("../../features/workbooks/WorkbookDayScreen", async () => {
  const { Sheet } = await import("../../ui/Sheet");
  return {
    WorkbookDaySheet: ({
      learner,
      date,
    }: {
      learner: { id: string; name: string; pauseViewer: string };
      date: string;
    }) => (
      <Sheet open tall title="Today" onOpenChange={() => {}}>
        <p data-maker={learner.id} data-viewer={learner.pauseViewer}>
          {learner.name}, {date}
        </p>
      </Sheet>
    ),
  };
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
      title: "angles",
      description: "",
      gradeBand: "5",
      strand: "geometry",
      prerequisites: [],
    },
  ],
  templates: [],
};
const level = areaSourceOf({
  level: {
    overall: { level: 5, sd: 0.6 },
    strands: { geometry: { level: 5, sd: 0.6 } },
  },
  reference: null,
  strands: [{ id: "geometry", label: "Geometry" }],
  weeks: [],
  objectives: [],
  work: [],
});
const inventory = `/family/${FAMILY}/kids/${WREN}/inventory`;

function over(path: string, learner: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(skillCatalogOptions.queryKey, catalog as never);
  client.setQueryData(sessionOptions.queryKey, session as never);
  client.setQueryData(familyOptions(session, FAMILY).queryKey, {
    familyId: FAMILY,
    children: [
      { id: WREN, name: "Wren", capabilities: { readWorkbooks: true } },
      { id: PIP, name: "Pip", capabilities: { readWorkbooks: false } },
    ],
  } as never);
  // The maker over a layer (an area's here), as a skill's Workbook opens it.
  seedLayers(layerScope(path, session.accountId), [
    { kind: "area", id: "geometry" },
    workbookDay(learner, DAY),
  ]);
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <>
          <main>The list</main>
          <LayerHost area={level} />
        </>
      ),
    }),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}
const stack = () =>
  document.querySelector("[data-layer-frame]")?.getAttribute("data-layers");

test("the maker is a layer over the one it was opened from; ✕ comes back to that layer, and the screen behind never changes", async () => {
  const router = over(inventory, WREN);
  const entries = router.history.length;
  const maker = await screen.findByRole("dialog", { name: "Today" });
  // The child's, as a parent reads it, on the day the layer names.
  const made = maker.querySelector("[data-maker]")!;
  expect(made.getAttribute("data-maker")).toBe(WREN);
  expect(made.getAttribute("data-viewer")).toBe("parent");
  expect(made.textContent).toBe(`Wren, ${DAY}`);
  expect(stack()).toBe(`area:geometry,workbook:${WREN}.${DAY}`);
  // One overlay, and the way back up names the layer under it.
  expect(document.querySelectorAll("[data-layer-scrim]")).toHaveLength(1);
  expect(
    [...document.querySelectorAll("[data-layer-crumb]")].map(
      (crumb) => crumb.textContent,
    ),
  ).toEqual(["Geometry"]);
  // The screen behind is the one it was opened on, at its own address.
  expect(screen.getByText("The list")).toBeTruthy();
  expect(router.state.location.href).toBe(inventory);
  fireEvent.click(document.querySelector("[data-layer-close]")!);
  await screen.findByRole("dialog", { name: "Geometry" });
  expect(stack()).toBe("area:geometry");
  expect(router.state.location.href).toBe(inventory);
  expect(router.history.length).toBe(entries);
});

test("a maker for a learner this reader may not open is put down, and said in the log", async () => {
  const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  // A child whose workbooks this parent doesn't read; a learner who isn't
  // the account's; any learner on a school's screen.
  for (const [path, learner] of [
    [`/family/${FAMILY}/kids/${PIP}/inventory`, PIP],
    [inventory, STRANGER],
    ["/school/some-school/students", WREN],
  ] as const) {
    over(path, learner);
    await waitFor(() => expect(stack()).toBe("area:geometry"));
    expect(document.querySelector("[data-maker]")).toBeNull();
    expect(warned).toHaveBeenLastCalledWith(
      "A workbook layer this reader may not open was put down",
      { learner },
    );
    cleanup();
    useLayerStore.setState({ stacks: {}, motion: null });
  }
});
