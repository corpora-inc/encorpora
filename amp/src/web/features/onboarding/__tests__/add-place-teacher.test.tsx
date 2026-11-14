import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { meOptions, sessionOptions } from "../../../lib/query";
import { Starter } from "../Starter";

const FROM = "/school/11111111-1111-4111-8111-111111111111/classes";
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({}),
  useLocation: () => ({ search: { from: FROM } }),
  useRouter: () => ({}),
  useNavigate: () => vi.fn(),
  Navigate: () => null,
  Link: ({
    children,
    to,
    search,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
  }) => (
    <a
      href={`${to}${search && Object.keys(search).length ? `?${new URLSearchParams(search)}` : ""}`}
    >
      {children}
    </a>
  ),
}));
afterEach(cleanup);

test("CP-2 r2 M4: the teacher's choice in Add a place keeps its way back", () => {
  const client = new QueryClient();
  const session = { accountId: "amp|jo", token: "t" };
  client.setQueryData(sessionOptions.queryKey, session);
  client.setQueryData(meOptions(session).queryKey, {
    signedIn: true,
    account: { id: session.accountId, email: null, emailVerified: true },
    consent: { status: "active", method: null },
    learners: [],
    family: { learners: [] },
    adultPractice: {
      eligible: true,
      learner: { id: "jo", name: "Jo", active: true },
    },
  } as never);
  render(
    <QueryClientProvider client={client}>
      <Starter />
    </QueryClientProvider>,
  );
  const teacher = screen.getByText("I’m a teacher").closest("a")!;
  expect(teacher.getAttribute("href")).toBe(
    `/school/start?from=${encodeURIComponent(FROM)}`,
  );
});

vi.mock("../../../nav/links", () => ({ useCloseClick: () => () => {} }));
test("CP-2 r2 M4: a school page opened to add a place offers Cancel back there", async () => {
  const { PlainPage } = await import("../../school/PlainPage");
  render(
    <PlainPage back={FROM} backLabel="Cancel">
      body
    </PlainPage>,
  );
  expect(screen.getByText("Cancel").closest("a")!.getAttribute("href")).toBe(
    FROM,
  );
});
