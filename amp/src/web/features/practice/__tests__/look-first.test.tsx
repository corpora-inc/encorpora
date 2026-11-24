import "../celebration/__tests__/css-stub";
import { cleanup, render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { queryClient } from "../../../lib/query";
import { lookFirst, rememberLook } from "../look-ahead";
import { useLook } from "../look";

const server = vi.hoisted(() => ({
  states: {} as Record<string, unknown>,
  reads: [] as string[],
  fail: false,
}));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(async (path: string) => {
    const id = path.split("/")[2]!;
    server.reads.push(id);
    if (server.fail) throw new Error("offline");
    return server.states[id];
  }),
}));
const state = (effectiveLook: "calm" | "bold") => ({
  revision: 1,
  epoch: 0,
  workingTogether: false,
  focusSkillId: null,
  gradeLevelShown: true,
  strandStarts: {},
  look: null,
  effectiveLook,
  lookLocked: false,
  lookLockedBy: null,
});
const scope = (learnerId: string) => ({ identity: "account-1", learnerId });
const root = document.documentElement;
const look = () => root.getAttribute("data-look");

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  server.reads = [];
  server.fail = false;
  server.states = { pip: state("bold"), theo: state("calm") };
});
afterEach(() => {
  cleanup();
  root.removeAttribute("data-look");
  root.removeAttribute("data-look-arriving");
  root.removeAttribute("style");
});

function Host({ learnerId }: { learnerId: string }) {
  useLook(scope(learnerId));
  return null;
}
const mount = (learnerId: string) =>
  render(
    <QueryClientProvider client={queryClient}>
      <Host learnerId={learnerId} />
    </QueryClientProvider>,
  );

test("a Colorful learner new to this device is dressed in their screen's first commit, on one read", async () => {
  // Nothing remembered: a shared laptop's next child.
  expect(localStorage.getItem("amp.look-ahead")).toBeNull();
  await lookFirst(scope("pip"));
  expect(look()).toBeNull();
  const view = mount("pip");
  // No wait: the commit that mounts the screen has put the dress on.
  expect(look()).toBe("bold");
  expect(root.style.getPropertyValue("--look-hue")).not.toBe("");
  // The screen used the answer read ahead of it.
  expect(server.reads).toEqual(["pip"]);
  view.unmount();
  expect(look()).toBeNull();
});

test("a Calm learner's first commit is Calm, even where this device last showed them Colorful", async () => {
  rememberLook("theo", 120);
  await lookFirst(scope("theo"));
  const view = mount("theo");
  expect(look()).toBeNull();
  expect(root.hasAttribute("data-look-arriving")).toBe(false);
  expect(JSON.parse(localStorage.getItem("amp.look-ahead") ?? "{}")).toEqual(
    {},
  );
  expect(server.reads).toEqual(["theo"]);
  view.unmount();
});

test("a read that fails holds nothing up: the screen opens and reads it itself", async () => {
  server.fail = true;
  const warned = vi.spyOn(console, "warn").mockImplementation(() => {});
  await expect(lookFirst(scope("pip"))).resolves.toBeUndefined();
  expect(warned).toHaveBeenCalled();
  warned.mockRestore();
  await expect(lookFirst(null)).resolves.toBeUndefined();
});

test("a later move inside the app waits for nothing: the look in hand returns in the same task", async () => {
  await lookFirst(scope("pip"));
  expect(server.reads).toEqual(["pip"]);
  // Closing a book puts the focus back on the next frame: the screen has
  // to be there by then, so this may not cost a task (a chunk import does).
  let landed = false;
  void lookFirst(scope("pip")).then(() => {
    landed = true;
  });
  await Promise.resolve();
  expect(landed).toBe(true);
  expect(server.reads).toEqual(["pip"]);
});

test("two screens asking at once share one read", async () => {
  await Promise.all([lookFirst(scope("pip")), lookFirst(scope("pip"))]);
  expect(server.reads).toEqual(["pip"]);
});
