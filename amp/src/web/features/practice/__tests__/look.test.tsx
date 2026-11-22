import "../celebration/__tests__/css-stub";
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
  lookLockedBy: "class" | "adult" | null;
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
        const sent = options.body as {
          kind: string;
          locked?: boolean;
          hue?: number | null;
        };
        if (sent.kind === "lookHue") {
          const next = { ...(server.states[id] as object), lookHue: sent.hue };
          server.states[id] = next;
          return next;
        }
        if (sent.kind === "lookLock") {
          const next = {
            ...(server.states[id] as object),
            lookLocked: !!sent.locked,
            lookLockedBy: sent.locked ? "adult" : null,
          };
          server.states[id] = next;
          return next;
        }
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
    maya: state({
      look: null,
      effectiveLook: "bold",
      lookLocked: false,
      lookLockedBy: null,
    }),
    sam: state({
      look: null,
      effectiveLook: "calm",
      lookLocked: false,
      lookLockedBy: null,
    }),
    lockedKid: state({
      look: null,
      effectiveLook: "calm",
      lookLocked: true,
      lookLockedBy: "class",
    }),
    held: state({
      look: "bold",
      effectiveLook: "bold",
      lookLocked: true,
      lookLockedBy: "adult",
    }),
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

test("two hosts (a student's screens and their practice) share it: it stays until the last leaves", async () => {
  const shell = render(wrap(<Host learnerId="maya" />));
  const practice = render(wrap(<Host learnerId="maya" />));
  await waitFor(() => expect(bold()).toBe("bold"));
  // Practice leaves for standings: the shell still holds it.
  practice.unmount();
  expect(bold()).toBe("bold");
  // The student signs out (the shell's host goes): gone.
  shell.unmount();
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
  expect(await screen.findByText("Set by the class")).toBeTruthy();
  expect(
    (screen.getByRole("radio", { name: "Colorful" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(
    (screen.getByRole("radio", { name: "Calm" }) as HTMLButtonElement).disabled,
  ).toBe(true);
});

test("a parent's lock: the child's menu is disabled with the reason", async () => {
  render(wrap(<LookSetting scope={scope("held")} />));
  expect(await screen.findByText("Set by a parent")).toBeTruthy();
  expect(
    (screen.getByRole("radio", { name: "Colorful" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test("a parent's own view stays free to change, and holds or frees with the lock", async () => {
  render(wrap(<LookSetting scope={scope("held")} adult />));
  const lock = await screen.findByRole("button", { name: "Lock" });
  await waitFor(() => expect(lock.getAttribute("aria-pressed")).toBe("true"));
  expect(
    (screen.getByRole("radio", { name: "Calm" }) as HTMLButtonElement).disabled,
  ).toBe(false);
  fireEvent.click(lock);
  await waitFor(() =>
    expect(server.posts[0]?.body).toMatchObject({
      kind: "lookLock",
      locked: false,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "Lock" }).getAttribute("aria-pressed"),
    ).toBe("false"),
  );
});

test("a class's lock holds for the parent's view too, and says so", async () => {
  render(wrap(<LookSetting scope={scope("lockedKid")} adult />));
  expect(await screen.findByText("Set by the class")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Lock" })).toBeNull();
  expect(
    (screen.getByRole("radio", { name: "Colorful" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

test("the learner's own menu: the page follows the thumb, the color is kept when it is let go, and the wheel lets it go", async () => {
  render(wrap(<LookSetting scope={scope("maya")} />));
  const slider = (await screen.findByRole("slider", {
    name: "Color",
  })) as HTMLInputElement;
  const wheel = screen.getByRole("button", {
    name: "A new color every problem",
  });
  await waitFor(() => expect(wheel.getAttribute("aria-pressed")).toBe("true"));
  fireEvent.change(slider, { target: { value: "120" } });
  // Shown at once, with no turn, and not yet saved.
  expect(document.documentElement.style.getPropertyValue("--look-hue")).toBe(
    "120deg",
  );
  expect(document.documentElement.hasAttribute("data-look-arriving")).toBe(
    true,
  );
  expect(server.posts).toHaveLength(0);
  fireEvent.pointerUp(slider);
  await waitFor(() =>
    expect(server.posts.at(-1)?.body).toMatchObject({
      kind: "lookHue",
      hue: 120,
    }),
  );
  expect(document.documentElement.hasAttribute("data-look-arriving")).toBe(
    false,
  );
  await waitFor(() => expect(wheel.getAttribute("aria-pressed")).toBe("false"));
  fireEvent.click(wheel);
  await waitFor(() =>
    expect(server.posts.at(-1)?.body).toMatchObject({
      kind: "lookHue",
      hue: null,
    }),
  );
  document.documentElement.style.removeProperty("--look-hue");
});

test("a tap on the thumb keeps the color on screen; arriving by Tab keeps nothing", async () => {
  document.documentElement.style.setProperty("--look-hue", "202deg");
  render(wrap(<LookSetting scope={scope("maya")} />));
  const slider = await screen.findByRole("slider", { name: "Color" });
  await waitFor(() => expect((slider as HTMLInputElement).value).toBe("202"));
  fireEvent.keyUp(slider, { key: "Tab" });
  expect(server.posts).toHaveLength(0);
  fireEvent.pointerUp(slider);
  await waitFor(() =>
    expect(server.posts.at(-1)?.body).toMatchObject({
      kind: "lookHue",
      hue: 202,
    }),
  );
  document.documentElement.style.removeProperty("--look-hue");
});

test("in Calm the color has nothing to choose, and a grown-up's view has no such row", async () => {
  const calm = render(wrap(<LookSetting scope={scope("sam")} />));
  const slider = await screen.findByRole("slider", { name: "Color" });
  await waitFor(() => expect((slider as HTMLInputElement).disabled).toBe(true));
  calm.unmount();
  render(wrap(<LookSetting scope={scope("maya")} adult />));
  await screen.findByRole("radio", { name: "Colorful" });
  expect(screen.queryByRole("slider", { name: "Color" })).toBeNull();
});

test("a kept color is the one on the page while the dress is on", async () => {
  server.states.maya = { ...(server.states.maya as object), lookHue: 64 };
  render(wrap(<Host learnerId="maya" />));
  await waitFor(() =>
    expect(document.documentElement.getAttribute("data-look")).toBe("bold"),
  );
  await waitFor(() =>
    expect(document.documentElement.style.getPropertyValue("--look-hue")).toBe(
      "64deg",
    ),
  );
});
