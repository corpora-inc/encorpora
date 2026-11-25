import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  type RouteComponent,
} from "@tanstack/react-router";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import type { AuthConfig } from "../../../auth-config";
import { CLEVER_SIGN_IN_CAUSES } from "../../../../schools/clever-sign-in-causes";
import {
  authConfigOptions,
  meOptions,
  queryClient,
  sessionOptions,
} from "../../../lib/query";
import { orgsOptions } from "../api";
import { ChooserScreen } from "../ChooserScreen";
import { CleverProblemScreen } from "../clever/CleverProblemScreen";

/*
 * Where a Clever sign-in can leave someone with nothing to open: staff with
 * no school in AMP (none listed on their staff record), and a sign-in that stopped. Each says why
 * and what to do, never a broken screen or the adult sign-in form.
 */
const SESSION = { accountId: "amp|staff", token: "t" };

afterEach(() => {
  cleanup();
  queryClient.clear();
  vi.unstubAllGlobals();
});

function at(path: string, pattern: string, component: RouteComponent) {
  vi.stubGlobal("fetch", () => new Promise<never>(() => {}));
  const root = createRootRoute({ component: Outlet });
  const router = createRouter({
    routeTree: root.addChildren([
      createRoute({ getParentRoute: () => root, path: pattern, component }),
      createRoute({ getParentRoute: () => root, path: "/sign-in" }),
      createRoute({ getParentRoute: () => root, path: "/school/start" }),
      createRoute({ getParentRoute: () => root, path: "/join" }),
    ]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function noSchool(account: object) {
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  queryClient.setQueryData(orgsOptions(SESSION).queryKey, [] as never);
  queryClient.setQueryData(meOptions(SESSION).queryKey, {
    signedIn: true,
    account: { id: SESSION.accountId, email: null, ...account },
    learners: [],
  } as never);
  at("/school", "/school", ChooserScreen);
}

test("Clever staff with no school in AMP are told their district decides", async () => {
  noSchool({ kind: "provider", districtName: "Certification ISD" });
  expect(
    await screen.findByRole("heading", { name: "No school in AMP yet" }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      /Certification ISD shares schools with AMP through Clever/,
    ),
  ).toBeTruthy();
  // Never a second, parallel school beside the district's.
  expect(screen.queryByRole("link", { name: "Set up your class" })).toBeNull();
});

test("anyone else with no school is offered a class", async () => {
  noSchool({ emailVerified: true });
  expect(
    await screen.findByRole("heading", { name: "No school yet" }),
  ).toBeTruthy();
  expect(
    screen.getByText("A class starts your free 30-day pilot."),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Set up your class" })).toBeTruthy();
});

test("a student whose school hasn't set up AMP is told to ask their teacher", async () => {
  at("/clever/not-connected", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", {
      name: "Your school hasn’t set up AMP yet.",
    }),
  ).toBeTruthy();
  expect(screen.getByText("Ask your teacher.")).toBeTruthy();
  // Clever can't let them in until the district acts, so no Clever button
  // that can only fail: their teacher's class code can.
  expect(screen.queryByRole("link", { name: "Log in with Clever" })).toBeNull();
  expect(
    screen
      .getByRole("link", { name: "Type a class code" })
      .getAttribute("href"),
  ).toBe("/join");
  // A child's screen: no adult sign-in form, no support address.
  expect(screen.queryByLabelText(/password/i)).toBeNull();
  expect(screen.queryByText("support@corpora.inc")).toBeNull();
});

test("each student cause asks for their teacher", async () => {
  for (const [cause, title, next] of [
    // A roster sync can add them in minutes: trying Clever again can work,
    // and it stays the student's sign-in.
    ["not-on-roster", "AMP can’t find your class yet.", "Log in with Clever"],
    ["disconnected", "Your school’s AMP is paused.", "Type a class code"],
  ]) {
    at(`/clever/${cause}`, "/clever/$reason", CleverProblemScreen);
    expect(await screen.findByRole("heading", { name: title })).toBeTruthy();
    expect(screen.getByText("Ask your teacher.")).toBeTruthy();
    expect(
      screen
        .getAllByRole("link")
        .map((link) => link.textContent || link.querySelector("img")?.alt),
    ).toEqual([next]);
    if (next === "Log in with Clever")
      expect(
        screen.getByRole("link", { name: next }).getAttribute("href"),
      ).toBe("/api/v1/school/sso/clever/start?as=student");
    cleanup();
  }
});

test("a parent who used Clever by mistake is sent to their own sign-in", async () => {
  at("/clever/guardian", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", {
      name: "Clever sign-in is for students and school staff.",
    }),
  ).toBeTruthy();
  // Never Clever again: it can't let a family in.
  expect(screen.queryByRole("link", { name: "Log in with Clever" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
  ).toBe("/sign-in");
  expect(screen.getByText("support@corpora.inc")).toBeTruthy();
});

test("a provider failure tries again and names the way to reach us", async () => {
  // Any cause AMP doesn't name, an object's own keys included.
  at("/clever/constructor", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", {
      name: "Clever sign-in didn’t finish.",
    }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Log in with Clever" })).toBeTruthy();
  expect(screen.getByText("support@corpora.inc")).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Sign in another way" }),
  ).toBeTruthy();
});

const SIGNUP = "https://schools.clever.com/signup/fixture";
function clever(config: { cleverDistrictSignupUrl?: string } = {}) {
  const advertised: AuthConfig = {
    mode: "accounts",
    passwords: true,
    providers: [],
    clever: true,
    ...config,
  };
  queryClient.setQueryData(authConfigOptions.queryKey, advertised);
}

test("every cause the server sends has its own words", async () => {
  for (const cause of CLEVER_SIGN_IN_CAUSES.filter((c) => c !== "failed")) {
    clever();
    at(`/clever/${cause}`, "/clever/$reason", CleverProblemScreen);
    const heading = await screen.findByRole("heading", { level: 1 });
    expect(heading.textContent, cause).not.toBe(
      "Clever sign-in didn’t finish.",
    );
    cleanup();
    queryClient.clear();
  }
});

const NOT_IN_CLEVER = "AMP isn’t in your Clever account yet";

test("a teacher whose district hasn't added AMP starts a pilot now and forwards the request", async () => {
  clever({ cleverDistrictSignupUrl: SIGNUP });
  at("/clever/not-added", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", { level: 1, name: NOT_IN_CLEVER }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "Your class can start today. Your district can add AMP later.",
    ),
  ).toBeTruthy();
  // Never blocked: the pilot is the first thing to do.
  expect(
    screen
      .getByRole("link", { name: "Start a free pilot" })
      .getAttribute("href"),
  ).toBe("/school/start");
  const request = screen.getByRole("region", {
    name: "Ask your district to add AMP",
  });
  const message = request.querySelector("[data-district-message]")!;
  expect(message.textContent).toContain(SIGNUP);
  // Their own mail, to whoever they choose: no recipient filled in.
  const mail = within(request)
    .getByRole("link", { name: "Email it" })
    .getAttribute("href")!;
  expect(mail).toMatch(/^mailto:\?subject=/);
  expect(decodeURIComponent(mail.split("body=")[1]!)).toBe(message.textContent);
  expect(
    within(request)
      .getByRole("link", { name: "District admin? Add AMP in Clever" })
      .getAttribute("href"),
  ).toBe(SIGNUP);
  expect(
    within(request).getByText(
      "Your pilot classes move into the district roster later. No work is lost.",
    ),
  ).toBeTruthy();
  expect(screen.getByText("Student? Ask your teacher.")).toBeTruthy();
  // The school pages' footer names the way to reach us, once.
  expect(screen.getAllByText("support@corpora.inc")).toHaveLength(1);
  expect(screen.queryByLabelText(/password/i)).toBeNull();
});

test("a sign-in started from district setup leads with adding AMP in Clever", async () => {
  clever({ cleverDistrictSignupUrl: SIGNUP });
  at("/clever/add-amp", "/clever/$reason", CleverProblemScreen);
  expect(
    await screen.findByRole("heading", { level: 1, name: NOT_IN_CLEVER }),
  ).toBeTruthy();
  expect(
    screen.getByText(
      "A district admin adds AMP in Clever, then signs in again to connect.",
    ),
  ).toBeTruthy();
  // The admin's step first, then the teacher's: both work today.
  const actions = [
    ...screen.getByRole("link", { name: "Add AMP in Clever" }).parentElement!
      .children,
  ].map((link) => [link.textContent, link.getAttribute("href")]);
  expect(actions).toEqual([
    ["Add AMP in Clever", SIGNUP],
    ["Teacher? Start a free pilot", "/school/start"],
  ]);
  // Not the admin: the same request, ready to forward, without repeating
  // the link above.
  const request = screen.getByRole("region", {
    name: "Not a district admin? Send them this",
  });
  expect(
    request.querySelector("[data-district-message]")!.textContent,
  ).toContain(SIGNUP);
  expect(
    within(request).queryByRole("link", {
      name: "District admin? Add AMP in Clever",
    }),
  ).toBeNull();
  expect(screen.getByText("Student? Ask your teacher.")).toBeTruthy();
});

test("without a Clever page to add AMP on, district setup's answer is the teacher's", async () => {
  clever();
  at("/clever/add-amp", "/clever/$reason", CleverProblemScreen);
  await screen.findByRole("heading", { level: 1, name: NOT_IN_CLEVER });
  expect(screen.queryByRole("link", { name: "Add AMP in Clever" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Start a free pilot" }).className,
  ).toMatch(/primary/);
  expect(
    screen.getByRole("region", { name: "Ask your district to add AMP" }),
  ).toBeTruthy();
});

test("the request copies as written, and says so in place", async () => {
  const writeText = vi.fn(async () => {});
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  clever({ cleverDistrictSignupUrl: SIGNUP });
  at("/clever/not-added", "/clever/$reason", CleverProblemScreen);
  const copy = await screen.findByRole("button", { name: /Copy message/ });
  fireEvent.click(copy);
  await screen.findByRole("button", { name: /^Copied$/ });
  expect(writeText).toHaveBeenCalledWith(
    document.querySelector("[data-district-message]")!.textContent,
  );
  expect(screen.getByRole("status").textContent).toBe("Message copied");
});

test("a refused clipboard leaves the message selected, and says so", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.stubGlobal("navigator", {
    ...navigator,
    clipboard: { writeText: async () => Promise.reject(new Error("denied")) },
  });
  clever({ cleverDistrictSignupUrl: SIGNUP });
  at("/clever/not-added", "/clever/$reason", CleverProblemScreen);
  fireEvent.click(await screen.findByRole("button", { name: /Copy message/ }));
  await screen.findByRole("button", { name: /^Selected$/ });
  expect(getSelection()!.toString()).toBe(
    document.querySelector("[data-district-message]")!.textContent,
  );
  expect(screen.getByRole("status").textContent).toBe(
    "Message selected. Copy it.",
  );
  // Never silent.
  expect(warn).toHaveBeenCalledWith(
    "The clipboard refused the district message",
    expect.any(Error),
  );
  warn.mockRestore();
});

test("without a configured signup page the request links AMP's schools page", async () => {
  clever();
  at("/clever/not-added", "/clever/$reason", CleverProblemScreen);
  await screen.findByRole("heading", { name: NOT_IN_CLEVER });
  expect(
    document.querySelector("[data-district-message]")!.textContent,
  ).toContain(`${location.origin}/schools`);
  expect(
    screen.queryByRole("link", { name: "District admin? Add AMP in Clever" }),
  ).toBeNull();
});
