import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { Launcher } from "../Launcher";

/* A school's student at `/` who can't practice yet is told why, in place:
   no "Continue" into a practice that would only say the same. */

const SESSION = { accountId: "school:student", token: "t" };
afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function student(practice?: "seat" | "waiting" | "ended", canPractice = true) {
  return {
    signedIn: true,
    account: { id: SESSION.accountId, kind: "student", email: null },
    consent: { status: "none", method: null },
    learners: [],
    family: {
      learners: [{ id: "learner", name: "Sam", deletedAt: null, canPractice }],
    },
    school: { className: "Room 4", ...(practice ? { practice } : {}) },
    next: "practice",
  };
}

async function mount(me: object) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ families: [], next: null })),
  );
  queryClient.setQueryData(sessionOptions.queryKey, () => SESSION);
  queryClient.setQueryData(meOptions(SESSION).queryKey, me as never);
  const router = createRouter({
    routeTree: createRootRoute({ component: Launcher }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test("an unseated student is asked to see their teacher, with nothing to continue", async () => {
  await mount(student("seat"));
  expect(
    await screen.findByRole("heading", {
      name: "Ask your teacher about your seat.",
    }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "Continue practicing" }),
  ).toBeNull();
});

test("a seated student continues their practice", async () => {
  await mount(student());
  expect(
    await screen.findByRole("link", { name: "Continue practicing" }),
  ).toBeTruthy();
});

test("a student whose learner can't practice, with no word from the school, has no seat yet", async () => {
  await mount(student(undefined, false));
  expect(
    await screen.findByRole("heading", {
      name: "Ask your teacher about your seat.",
    }),
  ).toBeTruthy();
});

test("a student in no class yet (rostered by Clever, no section) is told practice hasn't started", async () => {
  // The shape a classless Clever student's /me has (clever-server.integration).
  const me = student("waiting");
  await mount({
    ...me,
    school: { orgName: "Escuela Señora Núñez", practice: "waiting" },
  });
  expect(
    await screen.findByRole("heading", {
      name: "Your teacher hasn’t started practice yet.",
    }),
  ).toBeTruthy();
  expect(
    screen.queryByRole("link", { name: "Continue practicing" }),
  ).toBeNull();
});
