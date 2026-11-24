import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { AppError } from "../../../lib/AppError";
import { queryClient } from "../../../lib/query";
import {
  practiceSettingsOptions,
  usePracticeAdjustment,
} from "../practice-settings";

/** A learner's practice setting on the server: one revision, one hold. */
const server = vi.hoisted(() => ({
  revision: 0,
  focusSkillId: null as string | null,
  /** Changes another device saves between a read here and its write. */
  elsewhere: [] as string[],
  writes: [] as {
    skillId: string | null;
    revision: number;
    requestId: string;
  }[],
  failure: null as null | (() => unknown),
}));
vi.mock("../../../lib/api", async (actual) => ({
  ...(await actual<typeof import("../../../lib/api")>()),
  request: vi.fn(
    async (
      _path: string,
      _schema: unknown,
      options: { body?: (typeof server.writes)[number] } = {},
    ) => {
      const state = () => ({
        revision: server.revision,
        focusSkillId: server.focusSkillId,
      });
      if (!options.body) return state();
      server.writes.push(options.body);
      if (server.failure) throw server.failure();
      const other = server.elsewhere.shift();
      if (other !== undefined) {
        // The other device's write landed first.
        server.revision++;
        server.focusSkillId = other;
      }
      if (options.body.revision !== server.revision)
        throw new AppError(
          "validation",
          "Couldn’t save the learner change.",
          false,
          null,
          "Practice changed on another device. Reopen the menu and try again.",
          409,
        );
      server.revision++;
      server.focusSkillId = options.body.skillId;
      return state();
    },
  ),
}));
let learner = 0;
let scope = { identity: "account-1", learnerId: "" };
beforeEach(() => {
  queryClient.clear();
  server.revision = 3;
  server.focusSkillId = null;
  server.elsewhere = [];
  server.writes = [];
  server.failure = null;
  scope = { identity: "account-1", learnerId: `kid-${++learner}` };
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const adjustment = () =>
  renderHook(() => usePracticeAdjustment(scope)).result.current;

test("practice opened for a skill is held to it", async () => {
  const saved = await adjustment().hold("compound-probability");
  expect(saved?.focusSkillId).toBe("compound-probability");
  expect(server.writes).toHaveLength(1);
  expect(console.warn).not.toHaveBeenCalled();
});

test("another device's change saved between this screen's read and its write: the hold is read again and made over it", async () => {
  server.elsewhere = ["scatterplots"];
  const saved = await adjustment().hold("compound-probability");
  expect(saved?.focusSkillId).toBe("compound-probability");
  expect(server.focusSkillId).toBe("compound-probability");
  // Sent twice: on the revision it had read, then on the one saved since,
  // as a new change.
  expect(server.writes.map((write) => write.revision)).toEqual([3, 4]);
  expect(server.writes[0]!.requestId).not.toBe(server.writes[1]!.requestId);
  expect(console.warn).toHaveBeenCalledTimes(1);
});

test("a read that a newer one replaced (a settings event, a credited answer) is read again, never shown as a failure", async () => {
  const { queryKey } = practiceSettingsOptions(scope);
  const held = adjustment().hold("compound-probability");
  // The hold's read is on its way; a credited answer stops it (points.ts),
  // as a settings event's own read would.
  await queryClient.cancelQueries({ queryKey, exact: true });
  const saved = await held;
  expect(saved?.focusSkillId).toBe("compound-probability");
  expect(server.writes).toHaveLength(1);
});

test("a menu's own change is still refused over a newer one", async () => {
  server.elsewhere = ["scatterplots"];
  await expect(
    adjustment().change({ kind: "focus", skillId: null }),
  ).rejects.toMatchObject({ status: 409 });
  expect(server.writes).toHaveLength(1);
  expect(server.focusSkillId).toBe("scatterplots");
});

test("changes that keep arriving are shown after four tries, never tried for ever", async () => {
  server.elsewhere = ["a", "b", "c", "d", "e", "f"];
  await expect(adjustment().hold("compound-probability")).rejects.toMatchObject(
    { status: 409 },
  );
  expect(server.writes).toHaveLength(4);
});

test("any other failure is shown at once", async () => {
  server.failure = () =>
    new AppError(
      "validation",
      "This skill has no practice problems.",
      false,
      null,
      null,
      400,
    );
  await expect(adjustment().hold("no-such-skill")).rejects.toMatchObject({
    status: 400,
  });
  expect(server.writes).toHaveLength(1);
});
