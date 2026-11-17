import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { SignedInMe } from "../../../../account/contracts";
import { meOptions, queryClient, sessionOptions } from "../../../lib/query";
import { usePanelsStore } from "../../account/panels";
import { PrivacyPanel, privacyPanelsFor } from "../PrivacyPanel";

/* The server, as the privacy routes answer (src/family, src/parent-consent,
 * src/advertising). Every request is recorded. */
const server = vi.hoisted(() => ({
  calls: [] as { path: string; body: unknown }[],
}));
const NOTICE = {
  version: "2026-11",
  operator: {
    name: "Corpora",
    address: "1 Main St",
    telephone: "555-0100",
    email: "privacy@example.com",
  },
  privacyUrl: "https://example.com/privacy",
  childData: [],
  processors: [],
  reviewAndDeletion: "Review or delete any time.",
  pendingContactDays: 7,
  withdrawnEvidenceDays: 30,
  evidenceRetentionPurpose: "Proof of consent.",
};
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(
    async (path: string, _schema: unknown, options?: { body?: unknown }) => {
      server.calls.push({ path, body: options?.body });
      if (path === "/consent")
        return {
          consentActive: true,
          available: true,
          notice: NOTICE,
          noticeDigest: "a".repeat(64),
          request: null,
        };
      if (path === "/family/export-ticket") return { ticket: "t".repeat(43) };
      if (path.endsWith("delete-learning-data"))
        return {
          deletedLearners: 2,
          retainedBillingReferences: 0,
          billingManagementRequired: false,
          consentWithdrawn: true,
        };
      if (path.includes("purchase-measurement"))
        return { ...MEASUREMENT, status: "off" };
      return {};
    },
  ),
}));

const SESSION = { accountId: "parent", token: "test-token" };
const MEASUREMENT = {
  available: true,
  eligible: true,
  status: "off" as const,
  revision: null,
  noticeVersion: "google-adult-purchase-v3",
  grantedAt: null,
  expiresAt: null,
};
const learner = (id: string, extra: object = {}) => ({
  id,
  name: id,
  deletedAt: null,
  access: [],
  stripeLinked: false,
  ...extra,
});
const holder = (family: object = {}) =>
  ({
    signedIn: true,
    account: { email: "parent@example.com" },
    learners: [],
    family: {
      consent: {
        status: "active",
        policyVersion: "1",
        recordedAt: "2026-11-02T15:00:00Z",
        withdrawnAt: null,
      },
      learners: [learner("Pip"), learner("Wren")],
      retained: {
        identity: "Identity stays.",
        financial: "Financial records stay.",
        backups: "Backups expire.",
        privacyAuditDays: 30,
      },
      ...family,
    },
  }) as unknown as SignedInMe;

function mount(me: SignedInMe, node: ReactNode = <PrivacyPanel />) {
  queryClient.setQueryData(sessionOptions.queryKey, SESSION);
  queryClient.setQueryData(meOptions(SESSION).queryKey, me as never);
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <>{node}</> }),
    history: createMemoryHistory({ initialEntries: ["/account/privacy"] }),
  });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
const panel = (id: string) =>
  document.querySelector<HTMLDetailsElement>(
    `details:has([data-privacy-panel="${id}"])`,
  )!;
const summaries = () =>
  [...document.querySelectorAll("[data-privacy-panels] > details > summary")].map(
    (node) => node.textContent,
  );
const setGpc = (on: boolean) =>
  Object.defineProperty(navigator, "globalPrivacyControl", {
    value: on,
    configurable: true,
  });

beforeEach(() => {
  usePanelsStore.setState({ accounts: {} });
  setGpc(false);
});
afterEach(() => {
  cleanup();
  queryClient.clear();
  server.calls = [];
});

test("each reader sees only the panels that apply to them", () => {
  const all = privacyPanelsFor(
    holder({ purchaseMeasurement: MEASUREMENT }),
    false,
  );
  expect(all).toEqual([
    "consent",
    "export",
    "delete",
    "retention",
    "measurement",
    "documents",
  ]);
  // The app stores carry no purchase measurement.
  expect(
    privacyPanelsFor(holder({ purchaseMeasurement: MEASUREMENT }), true),
  ).not.toContain("measurement");
  // An adult on their own: nothing to consent to; their own record to delete.
  expect(
    privacyPanelsFor(
      holder({
        consent: { status: "not-recorded" },
        learners: [learner("Me", { adult: true })],
      }),
      false,
    ),
  ).toEqual(["export", "delete", "retention", "documents"]);
  // A second parent: the family's consent and records are the holder's.
  const second = {
    ...holder({ learners: [] }),
    secondParentOf: [{ orgId: "o", classId: "c", className: "F", learners: [] }],
  } as unknown as SignedInMe;
  expect(privacyPanelsFor(second, false)).toEqual([
    "export",
    "retention",
    "documents",
  ]);
  // Withdrawn consent stays reachable, to give it again.
  expect(
    privacyPanelsFor(
      holder({ consent: { status: "withdrawn" }, learners: [] }),
      false,
    ),
  ).toContain("consent");
});

test("the panels are disclosures, one open at a time, starting on the stored panel", async () => {
  usePanelsStore.setState({
    accounts: { parent: { privacy: "retention", billing: null } },
  });
  mount(holder());
  await screen.findByText("Data retention");
  expect(summaries()).toEqual([
    "Learning permission",
    "Download your data",
    "Delete learning data",
    "Data retention",
    "Policies & documents",
  ]);
  expect(panel("retention").open).toBe(true);
  // Retention: the server's own sentences.
  for (const line of ["Identity stays.", "Financial records stay.", "Backups expire."])
    expect(within(panel("retention")).getByText(line)).toBeTruthy();
  expect(
    within(panel("retention")).getByText(/expire after 30 days/),
  ).toBeTruthy();
  // Opening another folds this one and is remembered for a refresh.
  panel("export").open = true;
  fireEvent(panel("export"), new Event("toggle"));
  await waitFor(() => expect(panel("retention").open).toBe(false));
  expect(usePanelsStore.getState().accounts.parent?.privacy).toBe("export");
  expect(document.querySelectorAll("details[open]")).toHaveLength(1);
  // No panel has an address, a sheet or a dialog of its own.
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("download starts with one press: a ticket, then the browser's own download", async () => {
  const submit = vi
    .spyOn(HTMLFormElement.prototype, "submit")
    .mockImplementation(() => {});
  mount(holder());
  const button = await screen.findByRole("button", {
    name: "Download family data",
  });
  fireEvent.click(button);
  await screen.findByText(/Download requested/);
  expect(server.calls.map((call) => call.path)).toContain(
    "/family/export-ticket",
  );
  expect(submit).toHaveBeenCalledTimes(1);
  submit.mockRestore();
});

test("consent: withdrawing takes one inline confirm, then withdraws", async () => {
  mount(holder());
  const consent = await waitFor(() => {
    const at = panel("consent");
    expect(at).toBeTruthy();
    return at;
  });
  expect(
    within(consent).getByText("Consent given on November 2, 2026."),
  ).toBeTruthy();
  fireEvent.click(
    within(consent).getByRole("button", { name: "Withdraw consent" }),
  );
  expect(server.calls.map((call) => call.path)).not.toContain(
    "/family/consent/withdraw",
  );
  expect(within(consent).getByText(/Practice pauses for children under 13/))
    .toBeTruthy();
  fireEvent.click(
    within(consent).getByRole("button", { name: "Withdraw consent" }),
  );
  await waitFor(() =>
    expect(server.calls.map((call) => call.path)).toContain(
      "/family/consent/withdraw",
    ),
  );
});

test("delete: the terms, then one button deletes and says what happened", async () => {
  mount(holder());
  const remove = await waitFor(() =>
    within(panel("delete")).getByRole("button", {
      name: "Delete learning data",
    }),
  );
  expect(within(panel("delete")).getByText(/cannot be undone/)).toBeTruthy();
  fireEvent.click(remove);
  await within(panel("delete")).findByText(/2 learner histories were removed/);
  expect(
    server.calls.find((call) => call.path === "/family/delete-learning-data")
      ?.body,
  ).toEqual({ confirmation: "delete-learning-data" });
});

test("advertising: allowing takes the adult's own opt-in", async () => {
  mount(holder({ purchaseMeasurement: MEASUREMENT }));
  const google = await waitFor(() => {
    const at = document.querySelector<HTMLElement>(
      '[data-purchase-measurement="google"]',
    );
    expect(at).toBeTruthy();
    return at!;
  });
  const allow = within(google).getByRole("button", {
    name: "Allow purchase measurement",
  }) as HTMLButtonElement;
  expect(allow.disabled).toBe(true);
  fireEvent.click(within(google).getByRole("checkbox"));
  expect(allow.disabled).toBe(false);
  fireEvent.click(allow);
  await waitFor(() =>
    expect(
      server.calls.find((call) => call.path === "/family/purchase-measurement")
        ?.body,
    ).toMatchObject({ action: "allow", adultAttestation: true }),
  );
});

test("advertising honours Global Privacy Control: recorded as a withdrawal, and no way to allow", async () => {
  setGpc(true);
  mount(holder({ purchaseMeasurement: MEASUREMENT }));
  const google = await waitFor(() => {
    const at = document.querySelector<HTMLElement>(
      '[data-purchase-measurement="google"]',
    );
    expect(at).toBeTruthy();
    return at!;
  });
  await waitFor(() =>
    expect(
      server.calls.find((call) => call.path === "/family/purchase-measurement")
        ?.body,
    ).toEqual({ action: "withdraw" }),
  );
  expect(
    within(google).queryByRole("button", { name: "Allow purchase measurement" }),
  ).toBeNull();
  expect(within(google).queryByRole("checkbox")).toBeNull();
  expect(google.querySelector("[data-global-privacy-control]")).toBeTruthy();
});
