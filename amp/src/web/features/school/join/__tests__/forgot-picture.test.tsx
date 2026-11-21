import { QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryClient } from "../../../../lib/query";

const CODE = "ABCD23";
const PERSON = "11111111-1111-4111-8111-111111111111";
const roster = { students: [{ id: PERSON, name: "Ada", picturesSet: true }] };
let kind: "class" | "family" = "class";
const ask = vi.fn();
const read = vi.fn();
const withdraw = vi.fn();
const lookup = vi.fn();
const finish = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ code: CODE, person: PERSON }),
  useRouter: () => ({ preloadRoute: () => Promise.resolve() }),
  useNavigate: () => vi.fn(),
  Link: () => null,
}));
vi.mock("../api", async (original) => ({
  ...(await original<typeof import("../api")>()),
  joinRosterOptions: (code: string) => ({
    queryKey: ["join-roster", code],
    queryFn: () => lookup(),
    staleTime: 30_000,
    retry: false,
    refetchOnWindowFocus: false,
  }),
  askForgotPicture: (input: unknown) => ask(input),
  readForgotPicture: (input: unknown) => read(input),
  withdrawForgotPicture: (input: unknown) => withdraw(input),
  signInWithPictures: vi.fn(),
  useFinishSignIn: () => finish,
  finishingSignIn: () => false,
}));
vi.mock("../JoinFrame", () => ({
  JoinFrame: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const { PicturesScreen } = await import("../PicturesScreen");
const { useForgotStore, FORGOT_POLL_MS } = await import("../forgot");

beforeEach(() => {
  kind = "class";
  sessionStorage.clear();
  useForgotStore.setState({ asked: {} });
  queryClient.clear();
  ask.mockReset().mockResolvedValue({ state: "waiting" });
  withdraw.mockReset().mockResolvedValue({ state: "none" });
  read.mockReset().mockResolvedValue({ state: "waiting" });
  lookup.mockReset().mockImplementation(async () => ({
    class: { name: "Room", kind },
    ...roster,
    students: roster.students.map((s) => ({ ...s })),
  }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const mount = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <PicturesScreen />
    </QueryClientProvider>,
  );
const forgotButton = () =>
  screen.findByRole("button", { name: "Forgot your pictures?" });

test("picking: the action is offered; asking shows the waiting state in place", async () => {
  mount();
  fireEvent.click(await forgotButton());
  expect(await screen.findByText("Your teacher has been asked.")).toBeTruthy();
  expect(ask).toHaveBeenCalledWith({ code: CODE, personId: PERSON });
  expect(
    screen.getByRole("button", { name: "Pick your pictures" }),
  ).toBeTruthy();
  // The picture buttons rest.
  expect(
    (screen.getAllByRole("button", { pressed: false }) as HTMLButtonElement[])
      .filter((b) => b.getAttribute("aria-pressed") === "false")
      .every((b) => b.disabled),
  ).toBe(true);
});

test("a family's adult is the parent", async () => {
  kind = "family";
  mount();
  fireEvent.click(await forgotButton());
  expect(await screen.findByText("Your parent has been asked.")).toBeTruthy();
});

test("waiting polls, and a reset moves on to choosing new pictures", async () => {
  mount();
  fireEvent.click(await forgotButton());
  await screen.findByText("Your teacher has been asked.");
  await waitFor(() => expect(read).toHaveBeenCalled());
  // The adult resets: the next list says the pictures aren't set.
  lookup.mockImplementation(async () => ({
    class: { name: "Room", kind },
    students: [{ id: PERSON, name: "Ada", picturesSet: false }],
  }));
  read.mockResolvedValue({ state: "reset" });
  expect(
    await screen.findByText(
      "Pick 3 pictures you’ll remember",
      {},
      { timeout: FORGOT_POLL_MS * 2 },
    ),
  ).toBeTruthy();
  expect(useForgotStore.getState().asked).toEqual({});
}, 15_000);

test("backing out returns to picking", async () => {
  mount();
  fireEvent.click(await forgotButton());
  fireEvent.click(
    await screen.findByRole("button", { name: "Pick your pictures" }),
  );
  expect(await screen.findByText("Pick your 3 pictures")).toBeTruthy();
  expect(useForgotStore.getState().asked).toEqual({});
  expect(withdraw).toHaveBeenCalledWith({ code: CODE, personId: PERSON });
});

test("a failed ask says so plainly and retries", async () => {
  ask.mockRejectedValueOnce(new Error("offline"));
  mount();
  fireEvent.click(await forgotButton());
  expect(
    await screen.findByText("Your teacher wasn’t asked. Try again."),
  ).toBeTruthy();
  expect(console.warn).toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Ask again" }));
  expect(await screen.findByText("Your teacher has been asked.")).toBeTruthy();
});

test("a refresh while waiting comes back to waiting", async () => {
  useForgotStore.setState({ asked: { [`${CODE}/${PERSON}`]: Date.now() } });
  mount();
  expect(await screen.findByText("Your teacher has been asked.")).toBeTruthy();
  expect(ask).not.toHaveBeenCalled();
});

test("an old held request is ignored", async () => {
  useForgotStore.setState({
    asked: { [`${CODE}/${PERSON}`]: Date.now() - 31 * 60_000 },
  });
  mount();
  expect(await screen.findByText("Pick your 3 pictures")).toBeTruthy();
});

test("the server saying none returns to picking", async () => {
  useForgotStore.setState({ asked: { [`${CODE}/${PERSON}`]: Date.now() } });
  read.mockResolvedValue({ state: "none" });
  mount();
  expect(await screen.findByText("Pick your 3 pictures")).toBeTruthy();
});
