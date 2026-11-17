import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { skillCatalogOptions } from "../../lib/learning-view";
import { sessionOptions } from "../../lib/query";
import { LayerHost } from "../LayerHost";

// The lesson layer's own chunk fails to load (a deploy replaced it, the
// network dropped): the dynamic import rejects.
vi.mock("../../features/pathways/LessonDialog", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The route's error boundary: nothing of the lesson's may reach it. */
class RouteBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p>This screen could not be loaded.</p>
    ) : (
      this.props.children
    );
  }
}

test("a lesson whose chunk fails to load fails in its own sheet, and the page stays", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(skillCatalogOptions.queryKey, {
    skills: [],
    templates: [],
  });
  client.setQueryData(sessionOptions.queryKey, null);
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <RouteBoundary>
          <main>The map</main>
          <LayerHost />
        </RouteBoundary>
      ),
    }),
    history: createMemoryHistory({
      initialEntries: ["/?open=lesson%3Anonlinear-system-solve"],
    }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // The lesson's own overlay, named for the lesson when its title is known.
  const sheet = await screen.findByRole("dialog");
  expect(sheet.textContent).toContain(
    "The lesson could not be opened. Retry it, or reload the page.",
  );
  expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  // The page under it is still there; the route never saw the failure.
  expect(screen.getByText("The map")).toBeTruthy();
  expect(screen.queryByText("This screen could not be loaded.")).toBeNull();
  // Noisy, never silent.
  expect(errors).toHaveBeenCalledWith("Pathways lesson layer failed to load.");
});
