import { QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { useState } from "react";
import { afterEach, expect, test } from "vitest";
import { queryClient } from "../../../../../lib/query";
import { CodeSlot } from "../SignInCode";

/* Premium rule 1 on Today: the class code's slot holds one height whether
 * practice is open or not, so practice opening mid-visit moves nothing
 * below it. jsdom lays nothing out, so this holds the structure that makes
 * it true (the same slot, the same hidden height-holder in every state, the
 * feed's first item never re-placed); the pixels are measured in a real
 * browser by scripts/verify-school-spaces-ui.ts at 320, 390, 768 and 1280. */
afterEach(() => {
  cleanup();
  queryClient.clear();
});

const place = { org: "o", class: "c" };
const words = { names: "names", signIn: "sign in", Learners: "Students" };
let open: (code: string | null) => void = () => {};

function Today() {
  const [code, setCode] = useState<string | null>(null);
  open = setCode;
  return (
    <main>
      <header>
        <h1>Grade 4 Math</h1>
        <CodeSlot
          code={code}
          closedLine="Practice hasn’t started"
          place={place}
          words={words}
          board={false}
          manage
          locked={false}
        />
      </header>
      <ol>
        <li data-first-item="">Start class</li>
      </ol>
    </main>
  );
}

test("practice opening swaps the slot's contents and moves nothing below it", async () => {
  const root = createRootRoute();
  const leaf = createRoute({
    getParentRoute: () => root,
    path: "/",
    component: Today,
  });
  const router = createRouter({
    routeTree: root.addChildren([leaf]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  await act(async () => {
    await router.load();
  });
  const { container } = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  await act(async () => {});
  const slot = container.querySelector("[data-code-slot]")!;
  const hold = slot.firstElementChild!;
  const first = container.querySelector("[data-first-item]")!;
  const holdBefore = hold.outerHTML;
  const before = first.getBoundingClientRect();
  expect(slot.getAttribute("data-code-slot")).toBe("closed");
  expect(screen.getByText("Practice hasn’t started")).toBeTruthy();
  // Hidden from people and from the keyboard: it only holds the height.
  expect(hold.getAttribute("aria-hidden")).toBe("true");
  expect(hold.hasAttribute("inert")).toBe(true);
  expect(screen.queryByRole("button", { name: "Copy link" })).toBeNull();

  await act(async () => open("ABCDEF"));
  // The same slot and the same height-holder, untouched; only the layer
  // over it changed.
  expect(container.querySelector("[data-code-slot]")).toBe(slot);
  expect(slot.firstElementChild).toBe(hold);
  expect(hold.outerHTML).toBe(holdBefore);
  expect(slot.children).toHaveLength(2);
  expect(slot.getAttribute("data-code-slot")).toBe("open");
  expect(screen.getByRole("button", { name: "Copy link" })).toBeTruthy();
  expect(screen.queryByText("Practice hasn’t started")).toBeNull();
  // Nothing was inserted above the feed's first item.
  expect(container.querySelector("[data-first-item]")).toBe(first);
  expect(first.getBoundingClientRect()).toEqual(before);

  await act(async () => open(null));
  expect(slot.firstElementChild).toBe(hold);
  expect(hold.outerHTML).toBe(holdBefore);
  expect(slot.getAttribute("data-code-slot")).toBe("closed");
});
