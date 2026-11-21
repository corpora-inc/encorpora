import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryClient } from "../../../lib/query";
import { LookSetting } from "../LookSetting";
import { useLook } from "../look";

type State = {
  look: string | null;
  effectiveLook: string;
  lookLocked: boolean;
};
const server = vi.hoisted(() => ({
  states: {} as Record<string, unknown>,
  posts: [] as { path: string; body: unknown }[],
}));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(
    async (path: string, _schema: unknown, options?: { body?: unknown }) => {
      const id = path.split("/")[2]!;
      if (options?.body) {
        server.posts.push({ path, body: options.body });
        const next = {
          ...(server.states[id] as object),
          look: (options.body as { look: string }).look,
          effectiveLook: (options.body as { look: string }).look,
        };
        server.states[id] = next;
        return next;
      }
      return server.states[id];
    },
  ),
}));
const base = {
  revision: 2,
  epoch: 0,
  workingTogether: false,
  focusSkillId: null,
  gradeLevelShown: true,
  strandStarts: {},
};
const state = (extra: State) => ({ ...base, ...extra });
const scope = (learnerId: string) => ({ identity: "account-1", learnerId });

beforeEach(() => {
  queryClient.clear();
  server.posts = [];
  server.states = {
    maya: state({ look: null, effectiveLook: "bold", lookLocked: false }),
    sam: state({ look: null, effectiveLook: "calm", lookLocked: false }),
    lockedKid: state({ look: null, effectiveLook: "calm", lookLocked: true }),
  };
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-look");
});

function Host({
  learnerId,
  enabled = true,
}: {
  learnerId: string;
  enabled?: boolean;
}) {
  useLook(scope(learnerId), enabled);
  return null;
}
const wrap = (node: React.ReactNode) => (
  <QueryClientProvider client={queryClient}>{node}</QueryClientProvider>
);
const bold = () => document.documentElement.getAttribute("data-look");

test("data-look is on <html> while a Colorful learner's practice host is mounted, and gone after", async () => {
  const view = render(wrap(<Host learnerId="maya" />));
  await waitFor(() => expect(bold()).toBe("bold"));
  view.unmount();
  expect(bold()).toBeNull();
});

test("switching learner clears it; a calm learner never sets it", async () => {
  const view = render(wrap(<Host learnerId="maya" />));
  await waitFor(() => expect(bold()).toBe("bold"));
  view.rerender(wrap(<Host learnerId="sam" />));
  await waitFor(() => expect(bold()).toBeNull());
});

test("leaving practice (host disabled) clears it", async () => {
  const view = render(wrap(<Host learnerId="maya" />));
  await waitFor(() => expect(bold()).toBe("bold"));
  view.rerender(wrap(<Host learnerId="maya" enabled={false} />));
  expect(bold()).toBeNull();
});

test("the setting offers Calm and Colorful, saves a choice as the look change", async () => {
  render(wrap(<LookSetting scope={scope("sam")} />));
  const colorful = await screen.findByRole("radio", { name: "Colorful" });
  await waitFor(() =>
    expect((colorful as HTMLButtonElement).disabled).toBe(false),
  );
  expect(
    screen.getByRole("radio", { name: "Calm" }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(colorful);
  await waitFor(() =>
    expect(server.posts[0]?.body).toMatchObject({ kind: "look", look: "bold" }),
  );
  await waitFor(() =>
    expect(
      screen
        .getByRole("radio", { name: "Colorful" })
        .getAttribute("aria-checked"),
    ).toBe("true"),
  );
});

test("locked by a class: disabled, with the reason in the label row", async () => {
  render(wrap(<LookSetting scope={scope("lockedKid")} />));
  expect(await screen.findByText("Set by your class")).toBeTruthy();
  expect(
    (screen.getByRole("radio", { name: "Colorful" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("radio", { name: "Calm" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});
