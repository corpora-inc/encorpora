import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { SignInPictures } from "../Devices";
import type { FamilyChild } from "../api";
import type { FamilyPlace } from "../FamilyFrame";

const api = vi.hoisted(() => ({ reset: vi.fn(), options: vi.fn() }));
vi.mock("../../school/classes/api", () => ({
  useResetPictures: (session: unknown, place: unknown) => {
    api.options(session, place);
    return { mutateAsync: api.reset, isPending: false };
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const place = {
  session: { accountId: "parent", token: "test-token" },
  family: "family-id",
  own: { org: "org-id", id: "own-class" },
} as FamilyPlace;
const child = {
  id: "learner-id",
  name: "Morgan",
  classes: [
    { id: "another-class", personId: "another-person" },
    { id: "own-class", personId: "own-person" },
  ],
  capabilities: { manageDevices: true },
} as FamilyChild;
const show = (value = child) =>
  render(
    <dl>
      <SignInPictures place={place} child={value} />
    </dl>,
  );

test("the parent resets the child's person in their own class, preserving the learner", async () => {
  api.reset.mockResolvedValueOnce({ reset: true });
  show();
  fireEvent.click(screen.getByRole("button", { name: "Reset pictures" }));
  await waitFor(() => expect(api.reset).toHaveBeenCalledWith("own-person"));
  expect(api.options).toHaveBeenCalledWith(place.session, {
    org: "org-id",
    class: "own-class",
  });
  expect((await screen.findByRole("status")).textContent).toContain(
    "Morgan can choose three new pictures",
  );
});

test("picture reset is absent without device permission or own-class membership", () => {
  for (const value of [
    { ...child, capabilities: { ...child.capabilities, manageDevices: false } },
    { ...child, classes: [child.classes[0]!] },
  ]) {
    show(value);
    expect(screen.queryByRole("button", { name: "Reset pictures" })).toBeNull();
    cleanup();
  }
  expect(api.reset).not.toHaveBeenCalled();
});

test("a failed reset stays in the child's settings and does not report success", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    api.reset.mockRejectedValueOnce(new Error("offline"));
    show();
    fireEvent.click(screen.getByRole("button", { name: "Reset pictures" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "couldn’t be reset",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByRole("button", { name: "Reset pictures" })).toBeTruthy();
  } finally {
    log.mockRestore();
  }
});
