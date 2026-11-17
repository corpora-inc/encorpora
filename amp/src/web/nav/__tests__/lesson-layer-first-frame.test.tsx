import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { afterEach, expect, test } from "vitest";
import { lessonFilms } from "../../../content/lesson-films";
import { sessionOptions } from "../../lib/query";
import { LayerHost } from "../LayerHost";
import { useLayerStore } from "../layer-store";

afterEach(() => {
  cleanup();
  useLayerStore.setState({ stacks: {}, motion: null });
});

test("a lesson over the map opens whole: its title and film on its first frame", async () => {
  const filmed = Object.keys(lessonFilms)[0]!;
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(sessionOptions.queryKey, null);
  useLayerStore.setState({
    stacks: { "guest:/": [{ kind: "lesson", id: filmed }] },
    motion: null,
  });
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <>
          <main>The map</main>
          <LayerHost />
        </>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  // The overlay waits for the lesson's code, then shows whole: on its first
  // frame, its title and its film (the lesson's body waits in place).
  const sheet = await screen.findByRole("dialog", {}, { timeout: 15_000 });
  expect(sheet.querySelector("[data-layer-panel] h2")).not.toBeNull();
  expect(sheet.querySelector("[data-film-link]")).not.toBeNull();
});
