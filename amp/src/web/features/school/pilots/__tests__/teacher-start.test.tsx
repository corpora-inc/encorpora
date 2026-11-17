import { QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, beforeEach, expect, test } from "vitest";
import { meOptions, queryClient, sessionOptions } from "../../../../lib/query";
import { orgsOptions } from "../../api";
import {
  SchoolStartScreen,
  SchoolStartStudentsScreen,
} from "../SchoolStartScreen";
import { parseNames, useStartDraft } from "../start-steps";

afterEach(() => {
  cleanup();
  queryClient.clear();
});
beforeEach(() => {
  useStartDraft.getState().clear();
  window.scrollTo = () => {};
});

const auth = {
  accountId: "amp|teacher",
  token: "synthetic",
  name: "Rosa Lindqvist",
};

async function open(path: string) {
  queryClient.setQueryData(sessionOptions.queryKey, auth);
  queryClient.setQueryData(meOptions(auth).queryKey, {
    signedIn: true,
    account: {
      id: auth.accountId,
      email: "teacher@example.test",
      emailVerified: false,
      confirmationRequired: true,
    },
    family: { learners: [] },
    learners: [],
  } as never);
  queryClient.setQueryData(orgsOptions(auth).queryKey, []);
  const root = createRootRoute();
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({
        getParentRoute: () => root,
        path: "/school/start",
        component: SchoolStartScreen,
      }),
      createRoute({
        getParentRoute: () => root,
        path: "/school/start/students",
        component: SchoolStartStudentsScreen,
      }),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(() => new Promise((resolve) => setTimeout(resolve, 25)));
  return router;
}

/* Founder ruling 2026-11-15: a teacher starts a class with nothing in the
 * way. No confirmation email first, no role to type: the class, its students
 * and one tick, as two steps of the shared stepper with no in-page Back. */
test("a teacher names the class, then adds students and ticks once, with the name prefilled and no role", async () => {
  const router = await open("/school/start");
  expect(screen.getByText("Step 1 of 2")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /back|cancel/i })).toBe(null);
  expect(screen.queryByRole("button", { name: "Send another email" })).toBe(
    null,
  );
  const next = screen.getByRole("button", { name: "Next" });
  expect(next.hasAttribute("disabled")).toBe(true);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("School name"), {
      target: { value: "Birchwood Elementary" },
    });
    fireEvent.change(screen.getByLabelText("Class name"), {
      target: { value: "Grade 4 Math" },
    });
  });
  expect(next.hasAttribute("disabled")).toBe(false);
  await act(async () => {
    fireEvent.click(next);
    await new Promise((resolve) => setTimeout(resolve, 25));
  });
  expect(router.state.location.pathname).toBe("/school/start/students");
  expect(router.state.location.searchStr).toBe("");
  expect(screen.getByText("Step 2 of 2")).toBeTruthy();
  // The done step links to its own address: the only way back in a flow.
  expect(
    screen.getByRole("link", { name: /Your class/ }).getAttribute("href"),
  ).toBe("/school/start");
  expect(screen.queryByLabelText("Your role")).toBe(null);
  expect((screen.getByLabelText("Your name") as HTMLInputElement).value).toBe(
    "Rosa Lindqvist",
  );
  const create = screen.getByRole("button", { name: "Create class" });
  expect(create.hasAttribute("disabled")).toBe(true);
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/^Student names/), {
      target: { value: "Ana Ruiz\n\nBo\tLind\n" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
  });
  expect(
    screen
      .getByRole("button", { name: "Create class with 2 students" })
      .hasAttribute("disabled"),
  ).toBe(false);
});

test("the students step opened on its own offers the step that names the class, never a button that fails", async () => {
  await open("/school/start/students");
  expect(screen.queryByRole("button", { name: /Create class/ })).toBe(null);
  expect(
    screen.getByRole("link", { name: "Name your class" }).getAttribute("href"),
  ).toBe("/school/start");
});

test("pasted names: one a line, a spreadsheet's columns joined, blanks dropped", () => {
  expect(parseNames("Ana Ruiz\r\n\n  Bo\tLind \n\t\n")).toEqual([
    "Ana Ruiz",
    "Bo Lind",
  ]);
});
