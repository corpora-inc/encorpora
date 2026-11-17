import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { expect, test } from "vitest";
import { setupSavesKey, setupSavesSettled } from "../setup/kids-api";

/* Next on "Add your kids" tapped while a child's save is in flight: it waits
   for the save in the Query cache and goes on once it is done, never a dead
   button; a save that failed keeps the step. */

const session = { accountId: "fast-tap-parent" };

function save(client: QueryClient) {
  let settle!: (ok: boolean) => void;
  const result = new Promise((resolve, reject) => {
    settle = (ok) => (ok ? resolve("saved") : reject(Error("offline")));
  });
  const observer = new MutationObserver(client, {
    mutationKey: setupSavesKey(session),
    mutationFn: () => result,
  });
  const done = observer.mutate().catch(() => undefined);
  return { settle, done };
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test("Next during a child's save goes on once the save is done", async () => {
  const client = new QueryClient();
  const child = save(client);
  let next: boolean | undefined;
  void setupSavesSettled(client, session).then((ok) => (next = ok));
  await tick();
  expect(next).toBeUndefined();
  child.settle(true);
  await child.done;
  await tick();
  expect(next).toBe(true);
});

test("a save that failed keeps the step", async () => {
  const client = new QueryClient();
  const child = save(client);
  const next = setupSavesSettled(client, session);
  child.settle(false);
  expect(await next).toBe(false);
});

test("two children saving at once: Next waits for both", async () => {
  const client = new QueryClient();
  const first = save(client);
  const second = save(client);
  let next: boolean | undefined;
  void setupSavesSettled(client, session).then((ok) => (next = ok));
  first.settle(true);
  await first.done;
  await tick();
  expect(next).toBeUndefined();
  second.settle(true);
  await second.done;
  await tick();
  expect(next).toBe(true);
});

test("with nothing in flight, Next goes on at once", async () => {
  const client = new QueryClient();
  expect(await setupSavesSettled(client, session)).toBe(true);
  // Another account's save is not this one's.
  const other = new MutationObserver(client, {
    mutationKey: setupSavesKey({ accountId: "someone-else" }),
    mutationFn: () => new Promise(() => {}),
  });
  void other.mutate();
  expect(await setupSavesSettled(client, session)).toBe(true);
});
