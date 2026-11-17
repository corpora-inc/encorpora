import { act, cleanup, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import type { AuthSession, SessionChange } from "../../auth";
import { qk } from "../../lib/keys";
import { queryClient, sessionOptions } from "../../lib/query";
import { Providers } from "../providers";

const h = vi.hoisted(() => ({
  changed: null as
    null | ((session: AuthSession | null, change?: SessionChange) => void),
  mounts: 0,
}));
vi.mock("../../auth", async (original) => ({
  ...(await original<object>()),
  onSessionChanged: (
    callback: (session: AuthSession | null, change?: SessionChange) => void,
  ) => {
    h.changed = callback;
    return () => {};
  },
}));
// The account's `/me` refresh after a change: it never answers here.
vi.mock("../../lib/api", async (original) => ({
  ...(await original<object>()),
  request: () => new Promise(() => {}),
}));

const parent: AuthSession = { accountId: "amp|parent", token: "p" };
const child: AuthSession = { accountId: "school:aug", token: "st_aug" };
const other: AuthSession = { accountId: "amp|other", token: "o" };
const parentData = qk.account(parent.accountId, "pathways", "aug");

/** A screen's own state: a new instance means the tree was remounted. */
function Screen() {
  const [instance] = useState(() => ++h.mounts);
  return <p data-testid="screen">{instance}</p>;
}
const instance = () => Number(screen.getByTestId("screen").textContent);
const change = async (session: AuthSession | null, how: SessionChange = {}) => {
  await act(async () => {
    h.changed!(session, how);
  });
};

beforeEach(() => {
  h.mounts = 0;
  queryClient.setQueryData(sessionOptions.queryKey, parent);
  queryClient.setQueryData(parentData, { skills: ["kept"] });
  render(
    <Providers>
      <Screen />
    </Providers>,
  );
});
afterEach(() => {
  cleanup();
  queryClient.clear();
});

test("a family handoff keeps the screens and the parent's data, both ways", async () => {
  expect(instance()).toBe(1);
  // "Practice with Aug": the parent hands this device to their child.
  await change(child, { handoff: true });
  expect(instance()).toBe(1);
  expect(queryClient.getQueryData(parentData)).toEqual({ skills: ["kept"] });
  // Back to the family: the parent takes it back; their screen paints from
  // what it had, with no wait.
  await change(parent, { handoff: true });
  expect(instance()).toBe(1);
  expect(queryClient.getQueryData(parentData)).toEqual({ skills: ["kept"] });
});

test("another person's account starts the tree and the account data again", async () => {
  await change(other);
  expect(instance()).toBe(2);
  expect(queryClient.getQueryData(parentData)).toBeUndefined();
});

test("signing out starts the tree and the account data again", async () => {
  await change(null);
  expect(instance()).toBe(2);
  expect(queryClient.getQueryData(parentData)).toBeUndefined();
});

test("a handoff to nobody is a sign-out, whatever it says", async () => {
  await change(null, { handoff: true });
  expect(instance()).toBe(2);
  expect(queryClient.getQueryData(parentData)).toBeUndefined();
});
