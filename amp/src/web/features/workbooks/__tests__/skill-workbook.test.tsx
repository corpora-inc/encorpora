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
import { familyOptions } from "../../family/api";
import type { OpenedFor } from "../../practice/CurriculumPractice";
import { useWorkbookDrafts, workbookDayKey } from "../draft-store";
import { choicesLabel, defaultWorkbookChoices, localDate } from "../model";
import { SkillWorkbook } from "../SkillWorkbook";

/*
 * "Workbook" in a skill's layer: for the learner the layer is about, only
 * where their own workbooks would make one, and it opens today's maker held
 * to the skill. Every name here is made up.
 */
const FAMILY = "4f1b61ea-bb9a-4e91-a1f6-8d9163354046";
const WREN = "06d07ec5-426f-427a-af88-7c202a88dc0c";
const THEO = "17d572cf-ba95-46d9-a493-31703be257b5";
const PIP = "ba306a0b-1299-40a6-8034-f42327610261";
const STRANGER = "9b2c7f10-5a43-4c1e-9d0f-3a1b2c3d4e5f";
const OWN = "c0ffee00-0000-4000-8000-00000000000a";
const session = { accountId: "parent-1", token: "synthetic" };

type Access = {
  learningAllowed?: boolean;
  hasAccess?: boolean;
  freeAllowance?: { workbooks: { available: number } };
  deletedAt?: string | null;
};
const paid: Access = { learningAllowed: true, hasAccess: true };
const freeLeft = (available: number): Access => ({
  learningAllowed: true,
  hasAccess: false,
  freeAllowance: { workbooks: { available } },
});
const view = vi.hoisted(() => ({
  learners: [] as unknown[],
  own: null as string | null,
  ownPractice: false,
  profile: null as unknown,
  learner: null as { id: string } | null,
}));
vi.mock("../../../lib/learning-view", async (original) => ({
  ...(await original<typeof import("../../../lib/learning-view")>()),
  useLearningView: () => ({
    session: { data: { accountId: "parent-1", token: "synthetic" } },
    account: {
      adultPractice: { learner: view.own ? { id: view.own } : null },
      family: { learners: view.learners },
    },
    ownPractice: view.ownPractice,
    profile: view.profile,
    learner: view.learner,
  }),
}));
afterEach(() => {
  cleanup();
  view.learners = [];
  view.own = null;
  view.ownPractice = false;
  view.profile = null;
  view.learner = null;
  useWorkbookDrafts.setState({ days: {} });
});

const catalog = {
  skills: [
    { id: "angles", title: "Measuring angles", printable: true },
    { id: "proofs", title: "Triangle proofs", printable: false },
    { id: "older", title: "From a server that says nothing" },
  ].map((skill) => ({
    ...skill,
    description: "",
    gradeBand: "5",
    strand: "geometry",
    prerequisites: [],
  })),
  templates: [],
};
const child = (id: string, name: string, readWorkbooks = true) => ({
  id,
  name,
  capabilities: { readWorkbooks },
  classes: [{ id: "class-1", personId: `${id.slice(0, 24)}aaaaaaaaaaaa` }],
});
const projection = {
  familyId: FAMILY,
  children: [
    child(WREN, "Wren"),
    child(THEO, "Theo"),
    child(PIP, "Pip", false),
  ],
};
const family = (...learners: [string, Access][]) =>
  learners.map(([id, access]) => ({ id, deletedAt: null, ...access }));

async function offered(at: string, skill = "angles", opened?: OpenedFor) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(skillCatalogOptions.queryKey, catalog as never);
  client.setQueryData(
    familyOptions(session, FAMILY).queryKey,
    projection as never,
  );
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <>
          <SkillWorkbook skill={skill} opened={opened} />
          <span data-testid="drawn" />
        </>
      ),
    }),
    history: createMemoryHistory({ initialEntries: [at] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByTestId("drawn");
  return document.querySelector<HTMLAnchorElement>("a[data-skill-workbook]");
}
const today = localDate();
const inventory = `/family/${FAMILY}/kids/${WREN}/inventory`;

test("on a child's skill it is that child's, and opens today's maker held to the skill", async () => {
  view.learners = family([WREN, paid], [THEO, paid]);
  const link = (await offered(inventory))!;
  expect(link.textContent).toBe("Workbook");
  expect(link.getAttribute("aria-label")).toBe("Workbook for Wren");
  expect(link.getAttribute("data-workbook-for")).toBe(WREN);
  expect(link.getAttribute("href")).toBe(
    `/family/${FAMILY}/kids/${WREN}/workbooks/${today}`,
  );
  // Nothing is chosen until it is followed.
  const day = workbookDayKey(session.accountId, WREN, today);
  expect(useWorkbookDrafts.getState().days[day]).toBeUndefined();
  fireEvent.click(link);
  const draft = useWorkbookDrafts.getState().days[day]!;
  expect(draft.choices).toEqual({
    ...defaultWorkbookChoices,
    skills: ["angles"],
  });
  expect(draft.minutes).toBe(30);
  expect(draft.draft).toMatch(/^[0-9a-f-]{36}$/);
  expect(draft.number).toBeUndefined();
});

test("a layer opened for one child over a screen of several is that child's", async () => {
  view.learners = family([WREN, paid], [THEO, paid]);
  const link = (await offered(`/family/${FAMILY}`, "angles", {
    learner: THEO,
  }))!;
  expect(link.getAttribute("data-workbook-for")).toBe(THEO);
  expect(link.getAttribute("href")).toBe(
    `/family/${FAMILY}/kids/${THEO}/workbooks/${today}`,
  );
});

test("only where the maker would make one: never a control that leads to a refusal", async () => {
  // A skill with no problem type that prints; a server that doesn't say.
  view.learners = family([WREN, paid]);
  expect(await offered(inventory, "proofs")).toBeNull();
  cleanup();
  expect(await offered(inventory, "older")).toBeNull();
  cleanup();
  // The free workbooks are used and no access covers them.
  view.learners = family([WREN, freeLeft(0)]);
  expect(await offered(inventory)).toBeNull();
  cleanup();
  // One is left.
  view.learners = family([WREN, freeLeft(1)]);
  expect(await offered(inventory)).not.toBeNull();
  cleanup();
  // Learning isn't allowed yet (consent).
  view.learners = family([WREN, { learningAllowed: false, hasAccess: true }]);
  expect(await offered(inventory)).toBeNull();
  cleanup();
  // A parent who doesn't read the child's workbooks (a second parent).
  view.learners = family([PIP, paid]);
  expect(await offered(`/family/${FAMILY}/kids/${PIP}/inventory`)).toBeNull();
  cleanup();
  // A child this account's own list doesn't hold.
  view.learners = family([THEO, paid]);
  expect(await offered(inventory)).toBeNull();
  cleanup();
  // Their learning data was deleted.
  view.learners = family([WREN, { ...paid, deletedAt: "2026-11-01" }]);
  expect(await offered(inventory)).toBeNull();
  cleanup();
  // An address naming a learner who isn't the family's.
  view.learners = family([WREN, paid]);
  expect(
    await offered(`/family/${FAMILY}/kids/${STRANGER}/inventory`),
  ).toBeNull();
});

test("where a family's screen names no child, and in own practice, it is the adult's own", async () => {
  view.learners = family([WREN, paid], [OWN, paid]);
  // No own practice yet: nobody's.
  expect(await offered(`/family/${FAMILY}`)).toBeNull();
  cleanup();
  view.own = OWN;
  const link = (await offered(`/family/${FAMILY}`))!;
  expect(link.getAttribute("data-workbook-for")).toBe("self");
  expect(link.getAttribute("aria-label")).toBeNull();
  expect(link.getAttribute("href")).toBe(`/learners/${OWN}/workbooks/${today}`);
  cleanup();
  // Their own Inventory.
  view.ownPractice = true;
  view.learner = { id: OWN };
  expect((await offered("/inventory"))!.getAttribute("href")).toBe(
    `/learners/${OWN}/workbooks/${today}`,
  );
  cleanup();
  // Practicing as a profile: a profile has no workbooks.
  view.profile = { id: "p" };
  expect(await offered("/inventory")).toBeNull();
  cleanup();
  view.profile = null;
  // A class's workbooks are its own tab's.
  expect(
    await offered(`/school/${FAMILY}/classes/${FAMILY}/map`, "angles", {
      learner: WREN,
    }),
  ).toBeNull();
});

test("a held workbook's line names its skills; level and areas say nothing", () => {
  const area = (id: string) => id.toUpperCase();
  const held = [{ title: "Measuring angles" }];
  expect(choicesLabel(defaultWorkbookChoices, area, held)).toBe(
    "Measuring angles",
  );
  expect(
    choicesLabel(
      { areas: ["geometry"], lean: "stretch", lesson: false, skills: ["a"] },
      area,
      [...held, { title: "Dividing by a one-digit number" }],
    ),
  ).toBe("Measuring angles, Dividing by a one-digit number · Problems only");
  // An ordinary workbook reads as it did.
  expect(choicesLabel(defaultWorkbookChoices, area)).toBe("");
  expect(
    choicesLabel({ areas: ["geometry"], lean: "stretch", lesson: true }, area),
  ).toBe("GEOMETRY · Harder");
});
