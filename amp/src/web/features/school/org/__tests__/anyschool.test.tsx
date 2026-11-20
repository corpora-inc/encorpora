import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test, vi } from "vitest";
import { AGREEMENT_VERSION } from "../../../../../schools/agreement";
import type { IntegrationsResponse } from "../../../../../schools/org-contracts";

const requestAnySchool = vi.fn(async () => ({}));
vi.mock("../org-api", () => ({ requestAnySchool }));
vi.mock("../../api", () => ({
  currentSession: () => ({
    accountId: "amp|head",
    token: "synthetic",
    name: "Ruth Adeyemi",
  }),
  refreshSchool: vi.fn(async () => undefined),
}));
const { AnySchoolAction, anySchoolDetail } = await import("../AnySchool");

type State = NonNullable<IntegrationsResponse["anyschool"]>;
const O = "11111111-1111-4111-8111-111111111111",
  D = "22222222-2222-4222-8222-222222222222";
const state = (over: Partial<State> = {}): State => ({
  status: "none",
  setupEmail: null,
  requestedAt: null,
  invitedAt: null,
  districtOrgId: null,
  imported: false,
  ...over,
});

afterEach(() => {
  cleanup();
  requestAnySchool.mockClear();
});

async function mount(value: State, canManage = true) {
  const done = vi.fn();
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <AnySchoolAction
          orgId={O}
          state={value}
          canManage={canManage}
          onDone={done}
        />
      ),
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(<RouterProvider router={router} />);
  await router.load();
  return done;
}

test("each step of the request reads as one line", () => {
  expect(anySchoolDetail(state())).toMatch(/school not on Clever/);
  expect(
    anySchoolDetail(
      state({
        status: "requested",
        setupEmail: "office@cedar.example",
        requestedAt: "2026-11-20T12:00:00.000Z",
      }),
    ),
  ).toMatch(/Clever’s invitation goes to office@cedar\.example\.$/);
  expect(
    anySchoolDetail(
      state({
        status: "invited",
        setupEmail: "office@cedar.example",
        invitedAt: "2026-11-21T12:00:00.000Z",
      }),
    ),
  ).toMatch(/for 48 hours once opened/);
  expect(
    anySchoolDetail(state({ status: "connected", districtOrgId: D })),
  ).toMatch(/Move your classes in/);
  expect(
    anySchoolDetail(
      state({ status: "connected", districtOrgId: D, imported: true }),
    ),
  ).toBe("Connected. Your roster comes from Clever.");
});

test("an administrator asks with the setup email and the agreement", async () => {
  const done = await mount(state());
  fireEvent.click(
    await screen.findByRole("button", {
      name: "Set up Clever AnySchool with us",
    }),
  );
  const submit = await screen.findByRole("button", {
    name: "Request invitation",
  });
  expect(submit).toHaveProperty("disabled", true);
  fireEvent.change(screen.getByLabelText("Setup email"), {
    target: { value: " office@cedar.example " },
  });
  expect(screen.getByLabelText("Your name")).toHaveProperty(
    "value",
    "Ruth Adeyemi",
  );
  expect(submit).toHaveProperty("disabled", true);
  fireEvent.click(screen.getByRole("checkbox"));
  expect(submit).toHaveProperty("disabled", false);
  fireEvent.click(submit);
  await vi.waitFor(() => expect(done).toHaveBeenCalled());
  expect(requestAnySchool).toHaveBeenCalledWith(
    expect.objectContaining({ accountId: "amp|head" }),
    O,
    {
      setupEmail: "office@cedar.example",
      signerName: "Ruth Adeyemi",
      agreementVersion: AGREEMENT_VERSION,
      authorized: true,
    },
  );
});

test("a viewer sees where it stands, with nothing to press", async () => {
  await mount(state(), false);
  expect(screen.queryByRole("button")).toBeNull();
});

test("once connected, the classes move in through the adoption review", async () => {
  await mount(state({ status: "connected", districtOrgId: D }));
  expect(
    (await screen.findByRole("link", { name: "Move classes in" })).getAttribute(
      "href",
    ),
  ).toBe(`/school/adopt/${D}`);
  cleanup();
  await mount(state({ status: "connected", districtOrgId: D, imported: true }));
  expect(screen.queryByRole("link")).toBeNull();
});
