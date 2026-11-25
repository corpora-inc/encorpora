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
import type { ProgressRecord } from "../../../schools/teacher-contracts";
import {
  RecordLevels,
  RecordWork,
} from "../../features/school/classes/ProgressRecord";
import { skillCatalogOptions } from "../../lib/learning-view";
import { sessionOptions } from "../../lib/query";
import { areaSkills, areaSourceOf } from "../AreaLayer";
import { LayerHost } from "../LayerHost";
import { useLayerStore } from "../layer-store";

const practice = vi.hoisted(() => ({ allowed: false }));
vi.mock("../../lib/learning-view", async (original) => ({
  ...(await original<typeof import("../../lib/learning-view")>()),
  useLearningView: () => ({
    session: { data: null },
    canPractice: practice.allowed,
    viewOnly: false,
    learner: { id: "learner-1" },
  }),
}));
afterEach(() => {
  cleanup();
  practice.allowed = false;
  useLayerStore.setState({ stacks: {}, motion: null });
});

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

const skill = (id: string, gradeBand: string, strand = "geometry") => ({
  id,
  title: id.replace(/-/g, " "),
  description: `About ${id}`,
  gradeBand,
  strand,
  prerequisites: [],
});
const catalog = {
  skills: [
    skill("shapes", "3"),
    skill("angles", "5"),
    skill("area-of-triangles", "6"),
    skill("similar-triangles", "7"),
    skill("proofs", "geometry"),
    skill("circles", "geometry"),
    skill("ratios", "6", "ratio"),
  ],
  templates: [],
};
const record: ProgressRecord = {
  level: {
    overall: { level: 6.2, sd: 0.6 },
    strands: { geometry: { level: 6, sd: 0.6 } },
  },
  reference: null,
  strands: [{ id: "geometry", label: "Geometry" }],
  weeks: [],
  objectives: [
    {
      skillId: "angles",
      title: "angles",
      strand: "geometry",
      day: "2026-11-02",
    },
  ],
  work: [],
};

function renderPage(page: () => React.ReactNode, at = "/") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(skillCatalogOptions.queryKey, catalog);
  client.setQueryData(sessionOptions.queryKey, null);
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

test("the skills of an area sort into earned, working on (nearest first) and next up", () => {
  const placed = areaSkills(
    catalog.skills,
    "geometry",
    { level: 6, sd: 0.6 },
    new Set(["angles"]),
  );
  expect(placed.earned.map((e) => e.skill.id)).toEqual(["angles"]);
  expect(placed.working.map((e) => e.skill.id)).toEqual([
    "area-of-triangles",
    "similar-triangles",
  ]);
  // The first grade above the range with any: geometry's own course.
  expect(placed.next.map((e) => e.skill.id)).toEqual(["proofs", "circles"]);
  expect(placed.all.some((e) => e.skill.strand !== "geometry")).toBe(false);
});

test("a level's row opens its area over the page, never a step in history; ✕ closes it", async () => {
  const router = renderPage(() => (
    <>
      <RecordLevels record={record} empty="" openAreas />
      <LayerHost area={areaSourceOf(record)} />
    </>
  ));
  const row = await screen.findByRole("link", {
    name: /^Geometry: best guess Grade 6/,
  });
  // A new tab or a copied link opens the same layer.
  expect(row.getAttribute("href")).toBe("/?open=area%3Ageometry");
  const entries = router.history.length;
  fireEvent.click(row);
  const layer = await screen.findByRole("dialog", { name: "Geometry" });
  // The screen's layers, not its address or its history.
  expect(router.state.location.search).toEqual({});
  expect(router.history.length).toBe(entries);
  expect(layer.textContent).toContain(
    "Most likely Grade 6 · somewhere between Grade 5 and Grade 7",
  );
  // Each skill opens over the area, in the same overlay.
  const working = layer.querySelector("[data-area-group=working]")!;
  const links = [...working.querySelectorAll("a")];
  expect(links.map((a) => a.dataset.areaSkill)).toEqual([
    "area-of-triangles",
    "similar-triangles",
  ]);
  expect(links[0]!.getAttribute("href")).toBe(
    "/?open=area%3Ageometry%2Cskill%3Aarea-of-triangles",
  );
  expect(
    layer.querySelector("[data-area-group=earned]")!.textContent,
  ).toContain("angles");
  // No practice where the page didn't say this reader may start it.
  expect(layer.querySelector("[data-area-practice]")).toBeNull();
  fireEvent.click(links[0]!);
  await screen.findByRole("dialog", { name: "area of triangles" });
  // One overlay, one scrim, and the way back up: the layer under it (its
  // own title is the heading).
  expect(document.querySelectorAll("[data-layer-scrim]")).toHaveLength(1);
  const crumbs = [...document.querySelectorAll("[data-layer-crumb]")];
  expect(crumbs.map((crumb) => crumb.textContent)).toEqual(["Geometry"]);
  fireEvent.click(crumbs[0]!);
  await screen.findByRole("dialog", { name: "Geometry" });
  fireEvent.click(document.querySelector("[data-layer-close]")!);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(router.state.location.search).toEqual({});
});

test("a layer over a layer: ✕ and Escape put down that one, to the layer behind; the scrim puts the whole overlay away", async () => {
  renderPage(() => (
    <>
      <RecordLevels record={record} empty="" openAreas />
      <LayerHost area={areaSourceOf(record)} />
    </>
  ));
  const open = async () => {
    // (From the page, or with the area already open.)
    if (!screen.queryByRole("dialog"))
      fireEvent.click(
        await screen.findByRole("link", { name: /^Geometry: best guess/ }),
      );
    const area = await screen.findByRole("dialog", { name: "Geometry" });
    fireEvent.click(
      area.querySelector<HTMLElement>("[data-area-skill=area-of-triangles]")!,
    );
    await screen.findByRole("dialog", { name: "area of triangles" });
  };
  const stack = () =>
    document.querySelector("[data-layer-frame]")?.getAttribute("data-layers") ??
    "";
  await open();
  expect(stack()).toBe("area:geometry,skill:area-of-triangles");
  // ✕: the skill down, the area behind it again.
  fireEvent.click(document.querySelector("[data-layer-close]")!);
  await screen.findByRole("dialog", { name: "Geometry" });
  expect(stack()).toBe("area:geometry");
  // Escape: the same one step.
  await open();
  fireEvent.keyDown(document.querySelector("[data-layer-frame]")!, {
    key: "Escape",
  });
  await screen.findByRole("dialog", { name: "Geometry" });
  expect(stack()).toBe("area:geometry");
  // The scrim is the page: the whole overlay away.
  await open();
  const scrim = document.querySelector("[data-layer-scrim]")!;
  fireEvent.pointerDown(scrim, { button: 0 });
  fireEvent.click(scrim, { button: 0 });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(useLayerStore.getState().stacks).toEqual({});
});

test("an area offers practice across the area, not only its nearest skill", async () => {
  practice.allowed = true;
  const source = areaSourceOf(record);
  renderPage(() => <LayerHost area={source} />, "/?open=area%3Ageometry");
  const action = await screen.findByRole("link", {
    name: "Practice",
  });
  // Practice held to the area, at its own address.
  expect(action.getAttribute("href")).toBe(
    "/practice/learner-1/areas/geometry",
  );
});

test("Overall opens the whole level: every area, each opening in its place", async () => {
  renderPage(
    () => <LayerHost area={areaSourceOf(record)} />,
    "/?open=area%3Aoverall",
  );
  const layer = await screen.findByRole("dialog", { name: "Overall" });
  const area = layer.querySelector<HTMLAnchorElement>(
    "[data-area-row=geometry]",
  )!;
  // Replacing the top layer: Back from the area returns to the page.
  expect(area.getAttribute("href")).toBe("/?open=area%3Ageometry");
});

test("before any answer nothing opens; a hand-typed area says so", async () => {
  const empty = { ...record, level: null };
  renderPage(() => (
    <>
      <RecordLevels record={empty} empty="" openAreas />
    </>
  ));
  await screen.findByText("Overall");
  expect(screen.queryAllByRole("link")).toHaveLength(0);
  cleanup();
  renderPage(
    () => <LayerHost area={areaSourceOf(empty)} />,
    "/?open=area%3Ageometry",
  );
  expect((await screen.findByRole("dialog")).textContent).toContain(
    "No level here yet.",
  );
});

const item = (id: string, skillTitle: string) => ({
  id,
  day: "2026-11-09",
  at: "2026-11-09T15:12:00Z",
  prompt: "What is 2 + 2?",
  answer: "4",
  response: "4",
  result: "independent" as const,
  review: false,
  skill: skillTitle,
  strand: "number",
});

test("recent work: a row with somewhere to open is one whole link with a chevron; others are read", async () => {
  const withWork = {
    ...record,
    work: [item("a1b2c3d4e5", "angles"), item("f6e5d4c3b2", "unknown")],
  };
  renderPage(() => (
    <RecordWork
      record={withWork}
      workPath={(attempt, row) =>
        row.skill === "angles" ? { kind: "skill", id: "angles" } : undefined
      }
    />
  ));
  const rows = await screen.findAllByRole("link");
  expect(rows).toHaveLength(1);
  expect(rows[0]!.dataset.workItem).toBe("a1b2c3d4e5");
  expect(rows[0]!.getAttribute("href")).toBe("/?open=skill%3Aangles");
  expect(rows[0]!.querySelector("svg")).not.toBeNull();
  expect(document.querySelector('[data-work-item="f6e5d4c3b2"]')).toBeNull();
});

test("a skill's title reads inside the practice sentence", async () => {
  const { inSentence } = await import("../AreaLayer");
  expect(inSentence("The standard multiplication algorithm")).toBe(
    "the standard multiplication algorithm",
  );
  expect(inSentence("Dividing by a two-digit number")).toBe(
    "dividing by a two-digit number",
  );
  expect(inSentence("Pythagorean triples")).toBe("Pythagorean triples");
  expect(inSentence("GCF and LCM")).toBe("GCF and LCM");
});
