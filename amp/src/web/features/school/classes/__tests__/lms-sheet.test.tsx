import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import type { LmsResponse } from "../../../../../schools/lms-contracts";
import { queryClient, sessionOptions } from "../../../../lib/query";
import { districtProblem, LmsSheet, lmsLabel } from "../LmsSheet";

const O = "11111111-1111-4111-8111-111111111111";
const C = "22222222-2222-4222-8222-222222222222";
const TERM = "33333333-3333-4333-8333-333333333333";
const auth = { accountId: "amp|teacher", token: "synthetic" };
const row = (over: Partial<LmsResponse["assignments"][number]>) => ({
  id: "44444444-4444-4444-8444-444444444444",
  kind: "practice" as const,
  title: "Practice this week",
  pointsPossible: 100,
  targetMinutes: 60,
  opensOn: "2026-11-18",
  dueOn: "2026-11-23",
  termId: null,
  termName: null,
  status: "published" as const,
  lmsState: "open",
  failureCode: null,
  finalized: false,
  syncRequested: false,
  lastPassbackAt: null,
  graded: 12,
  blocked: 0,
  blockedBy: {},
  createdAt: "2026-11-18T12:00:00.000Z",
  ...over,
});
const data: LmsResponse = {
  lms: { type: "canvas", state: "success", failureCode: null },
  canEdit: true,
  today: "2026-11-20",
  terms: [
    {
      id: TERM,
      name: "Fall",
      startsOn: "2026-08-15",
      endsOn: "2026-12-20",
      state: "open",
    },
  ],
  assignments: [
    row({ blocked: 1, blockedBy: { lms_user_not_in_lms: 1 } }),
    row({
      id: "55555555-5555-4555-8555-555555555555",
      title: "Week two",
      failureCode: "lms_assignment_unpublished",
    }),
    row({
      id: "66666666-6666-4666-8666-666666666666",
      title: "Unanswered",
      status: "unknown",
      failureCode: "lms_create_outcome_unknown",
      graded: 0,
    }),
    row({
      id: "77777777-7777-4777-8777-777777777777",
      kind: "term_grade",
      title: "Fall grade",
      targetMinutes: null,
      opensOn: null,
      dueOn: "2026-12-20",
      termId: TERM,
      termName: "Fall",
      finalized: true,
    }),
  ],
};

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.restoreAllMocks();
});

async function mount() {
  const posts: { url: string; body: unknown }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input instanceof Request ? input.url : input);
    if (init?.method === "POST") {
      posts.push({ url, body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ id: row({}).id }), {
        status: 201,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  window.scrollTo = () => {};
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/school/$org/classes/$class/gradebook",
    component: () => (
      <LmsSheet
        open
        onOpenChange={() => {}}
        place={{ org: O, class: C }}
        lms={data.lms}
        weeklyTargetMinutes={45}
      />
    ),
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({
      initialEntries: [`/school/${O}/classes/${C}/gradebook`],
    }),
  });
  await act(async () => {
    await router.load();
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await screen.findByText("Practice this week");
  return { posts };
}

test("the button and sheet are named for the district's LMS", () => {
  expect(
    lmsLabel({ type: "google_classroom", state: "success", failureCode: null }),
  ).toBe("Google Classroom");
  expect(
    lmsLabel({ type: null, state: null, failureCode: "lms_forbidden" }),
  ).toBe("LMS");
});

test("each assignment says where it stands, and what a teacher can do about it", async () => {
  await mount();
  const items = screen.getAllByRole("listitem");
  expect(items).toHaveLength(4);
  const [first, second, third, fourth] = items as [
    HTMLElement,
    HTMLElement,
    HTMLElement,
    HTMLElement,
  ];
  expect(within(first).getByText("In Canvas")).toBeTruthy();
  expect(
    within(first).getByText(
      /60 min, Nov 18 to Nov 23 · 100 points · 12 graded/,
    ),
  ).toBeTruthy();
  expect(within(first).getByText("1 not in Canvas")).toBeTruthy();
  expect(within(second).getByText("Needs attention")).toBeTruthy();
  expect(
    within(second).getByText("Publish it in Canvas to send grades."),
  ).toBeTruthy();
  expect(within(third).getByText("Unconfirmed")).toBeTruthy();
  expect(
    within(third).getByRole("button", { name: "Publish again" }),
  ).toBeTruthy();
  expect(within(third).queryByRole("button", { name: "Send now" })).toBeNull();
  expect(within(fourth).getByText("Grades returned")).toBeTruthy();
  expect(
    within(fourth).getByText(/Fall final grades, due Dec 20/),
  ).toBeTruthy();
});

test("a status line is reserved even when there is nothing to say", async () => {
  await mount();
  const lines = document.querySelectorAll("[data-empty]");
  // The district line and one issue line per assignment, always present.
  expect(lines.length).toBe(5);
});

test("a new practice assignment starts from the class's weekly target", async () => {
  const { posts } = await mount();
  fireEvent.click(screen.getByRole("button", { name: "New assignment" }));
  expect(screen.getByRole("radio", { name: "Practice minutes" })).toBeTruthy();
  expect((screen.getByLabelText("Minutes") as HTMLInputElement).value).toBe(
    "45",
  );
  fireEvent.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]!.url).toContain(
    `/api/v1/school/classes/${C}/lms/assignments`,
  );
  expect(posts[0]!.body).toEqual({
    kind: "practice",
    title: "Practice 45 minutes",
    pointsPossible: 100,
    targetMinutes: 45,
    opensOn: "2026-11-20",
    dueOn: "2026-11-26",
    // A term-grade draft field never leaks into a practice body.
  });
});

test("delete asks in place, never in a browser dialog", async () => {
  const confirm = vi.spyOn(window, "confirm");
  const { posts } = await mount();
  const first = screen.getAllByRole("listitem")[0]!;
  fireEvent.click(within(first).getByRole("button", { name: "Delete" }));
  fireEvent.click(
    within(first).getByRole("button", { name: "Delete from Canvas" }),
  );
  await waitFor(() => expect(posts).toHaveLength(1));
  expect(posts[0]!.url).toContain(`/lms/assignments/${row({}).id}/delete`);
  expect(confirm).not.toHaveBeenCalled();
});

test("the district's own state is what the sheet says", () => {
  const ok = { type: "canvas" as const, state: "success", failureCode: null };
  expect(districtProblem(ok)).toBeNull();
  expect(
    districtProblem({
      ...ok,
      state: "matching_in_progress",
      failureCode: "lms_not_ready",
    }),
  ).toBe("Clever is still matching this district’s LMS.");
  expect(
    districtProblem({
      ...ok,
      state: "disconnected",
      failureCode: "lms_not_ready",
    }),
  ).toBe("The district disconnected its LMS from Clever.");
  expect(districtProblem({ ...ok, failureCode: "lms_forbidden" })).toMatch(
    /refused access/,
  );
  expect(districtProblem({ ...ok, failureCode: "lms_network_failed" })).toMatch(
    /couldn’t be reached/,
  );
});
