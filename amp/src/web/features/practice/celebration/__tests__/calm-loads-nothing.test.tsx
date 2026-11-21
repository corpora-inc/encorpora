import "./css-stub";
import { act, cleanup, render } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
import { queryClient } from "../../../../lib/query";

const loaded = vi.hoisted(() => ({ colorful: 0 }));
vi.mock("../Colorful", () => {
  loaded.colorful++;
  return { Colorful: () => null };
});
vi.mock("../../../../lib/session", async (actual) => ({
  ...(await actual<typeof import("../../../../lib/session")>()),
  useSessionOrNull: () => ({ accountId: "account-1", token: "t" }),
}));
vi.mock("../../../spaces/useAddressed", () => ({
  useAddressedIdentity: () => ({ kind: "learner", id: "kid-1" }),
}));

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-look");
});

const flush = () => act(async () => new Promise((r) => setTimeout(r, 20)));

it("a Calm learner never loads Colorful's code; one in Colorful does, as the look resolves", async () => {
  const { Celebration } = await import("../Celebration");
  const host = (
    <QueryClientProvider client={queryClient}>
      <Celebration outcome={null} problem={{ id: "p1" }} />
    </QueryClientProvider>
  );
  const view = render(host);
  await flush();
  expect(loaded.colorful).toBe(0);
  document.documentElement.setAttribute("data-look", "bold");
  await flush();
  expect(loaded.colorful).toBe(1);
  view.unmount();
});
