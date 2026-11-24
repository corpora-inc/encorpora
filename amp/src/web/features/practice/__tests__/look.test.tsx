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
import { act } from "react";
import { settleChipRoom } from "../chip-room";
import { LookSetting } from "../LookSetting";
import { useLook } from "../look";
import { problemTurned } from "../look-feed";
import { practiceSettingsOptions } from "../practice-settings";

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
      effectiveLook: "calm",
      lookLocked: true,
      lookLockedBy: "adult",
    }),
  };
});
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-look");
  document.documentElement.removeAttribute("data-chip-room");
  document.body.replaceChildren();
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
const room = () => document.documentElement.hasAttribute("data-chip-room");
/** A learner's menu, opened as the app opens it: their look is read first
 * (look-known.ts), then the rows mount. */
async function menu(learnerId: string) {
  await queryClient.fetchQuery(practiceSettingsOptions(scope(learnerId)));
  return render(wrap(<LookSetting scope={scope(learnerId)} />));
}
/** The server's answer changes, and this screen reads it. */
async function elsewhere(learnerId: string, change: Partial<State>) {
  server.states[learnerId] = {
    ...(server.states[learnerId] as object),
    ...change,
  };
  await act(async () => {
    await queryClient.invalidateQueries(
      practiceSettingsOptions(scope(learnerId)),
    );
    // The cache tells its screens in a task of its own.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}
/** A learner's practice, open, with the server's answer on the page (what
 * the device remembers of their look goes on before it: look-ahead.ts). */
async function practising(learnerId: string) {
  const view = render(wrap(<Host learnerId={learnerId} />));
  await waitFor(() =>
    expect(
      queryClient.getQueryData(
        practiceSettingsOptions(scope(learnerId)).queryKey,
      ),
    ).toBeTruthy(),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return view;
}
const off = {
  effectiveLook: "calm",
  lookLocked: true,
  lookLockedBy: "class",
} as const;
const on = {
  effectiveLook: "bold",
  lookLocked: false,
  lookLockedBy: null,
} as const;
/** An answer's feedback, as practice shows it. */
function feedback() {
  const sheet = document.createElement("section");
  sheet.className = "feedback correct";
  document.body.append(sheet);
  return sheet;
}
/** The next problem arrives (celebration/Celebration.tsx). */
const nextProblem = () =>
  act(() => {
    settleChipRoom();
    problemTurned();
  });

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
  await menu("sam");
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

test("Colorful off, by a class or by a parent: the learner's menu has no Look and no color at all", async () => {
  for (const learner of ["lockedKid", "held"]) {
    const view = await menu(learner);
    expect(view.container.querySelector("[data-look-setting]")).toBeNull();
    // Absent: not disabled, and nothing says who set it.
    expect(screen.queryByRole("radio", { name: "Colorful" })).toBeNull();
    expect(screen.queryByRole("radio", { name: "Calm" })).toBeNull();
    expect(screen.queryByRole("slider", { name: "Color" })).toBeNull();
    expect(screen.queryByText(/Set by/)).toBeNull();
    expect(view.container.textContent).toBe("");
    view.unmount();
  }
});

test("the learner's own menu: the page follows the thumb, the color is kept when it is let go, and the wheel lets it go", async () => {
  await menu("maya");
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
  await menu("maya");
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

test("in Calm the color has nothing to choose", async () => {
  await menu("sam");
  const slider = await screen.findByRole("slider", { name: "Color" });
  await waitFor(() => expect((slider as HTMLInputElement).disabled).toBe(true));
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

test("the rows are settled as the menu opens: a switch turned off while it is open takes nothing away, and they are gone the next time", async () => {
  const view = await menu("maya");
  const colorful = screen.getByRole("radio", { name: "Colorful" });
  expect((colorful as HTMLButtonElement).disabled).toBe(false);
  await elsewhere("maya", off);
  // Still there, in place, resting: nothing moved under a finger.
  expect(view.container.querySelector("[data-look-setting]")).not.toBeNull();
  for (const name of ["Calm", "Colorful"])
    expect(
      (screen.getByRole("radio", { name }) as HTMLButtonElement).disabled,
    ).toBe(true);
  expect(
    (screen.getByRole("slider", { name: "Color" }) as HTMLInputElement)
      .disabled,
  ).toBe(true);
  view.unmount();
  const again = await menu("maya");
  expect(again.container.textContent).toBe("");
});

test("a switch turned on while the menu is open adds no rows under a finger; the next opening has them", async () => {
  const view = await menu("lockedKid");
  expect(view.container.textContent).toBe("");
  await elsewhere("lockedKid", on);
  expect(view.container.textContent).toBe("");
  view.unmount();
  await menu("lockedKid");
  expect(screen.getByRole("radio", { name: "Colorful" })).toBeTruthy();
});

test("nothing known of the look as the menu opens: no rows, and none arrive later in that opening", async () => {
  const view = render(wrap(<LookSetting scope={scope("maya")} />));
  expect(view.container.textContent).toBe("");
  await waitFor(() =>
    expect(
      queryClient.getQueryData(practiceSettingsOptions(scope("maya")).queryKey),
    ).toBeTruthy(),
  );
  expect(view.container.textContent).toBe("");
});

test("a look changed somewhere else goes on an open problem at once, both ways", async () => {
  await practising("maya");
  await waitFor(() => expect(bold()).toBe("bold"));
  await elsewhere("maya", off);
  expect(bold()).toBeNull();
  await elsewhere("maya", on);
  await waitFor(() => expect(bold()).toBe("bold"));
});

test("while an answer's feedback is on screen it waits for the next problem, and arrives with it", async () => {
  await practising("maya");
  await waitFor(() => expect(bold()).toBe("bold"));
  const sheet = feedback();
  await elsewhere("maya", off);
  // The sheet being read keeps its look.
  expect(bold()).toBe("bold");
  sheet.remove();
  nextProblem();
  expect(bold()).toBeNull();
  // And the other way.
  const next = feedback();
  await elsewhere("maya", on);
  expect(bold()).toBeNull();
  next.remove();
  nextProblem();
  await waitFor(() => expect(bold()).toBe("bold"));
});

test("their own choice in the menu shows at once, feedback or not", async () => {
  await practising("maya");
  await waitFor(() => expect(bold()).toBe("bold"));
  feedback();
  const sheet = document.createElement("div");
  sheet.setAttribute("data-navigation-sheet", "");
  document.body.append(sheet);
  await elsewhere("maya", { effectiveLook: "calm", look: "calm" });
  expect(bold()).toBeNull();
});

test("the chip's room is the problem's: it comes with the screen or a problem, and a look that changes under a problem leaves it alone", async () => {
  await practising("maya");
  await waitFor(() => expect(bold()).toBe("bold"));
  // The screen arrived Colorful: its chip has its room.
  await waitFor(() => expect(room()).toBe(true));
  // Calm under the open problem: the room stays, so nothing wraps.
  await elsewhere("maya", off);
  expect(bold()).toBeNull();
  expect(room()).toBe(true);
  // The next problem has the whole line.
  nextProblem();
  expect(room()).toBe(false);
  // Colorful under an open problem: the colors come, the room waits.
  await elsewhere("maya", on);
  await waitFor(() => expect(bold()).toBe("bold"));
  expect(room()).toBe(false);
  nextProblem();
  expect(room()).toBe(true);
});

test("a look that waited for the next problem settles the chip's room with it", async () => {
  await practising("maya");
  await waitFor(() => expect(room()).toBe(true));
  const sheet = feedback();
  await elsewhere("maya", off);
  expect(room()).toBe(true);
  sheet.remove();
  nextProblem();
  expect(bold()).toBeNull();
  expect(room()).toBe(false);
  const next = feedback();
  await elsewhere("maya", on);
  next.remove();
  nextProblem();
  await waitFor(() => expect(bold()).toBe("bold"));
  expect(room()).toBe(true);
});
