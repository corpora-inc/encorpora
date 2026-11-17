import { isRedirect } from "@tanstack/react-router";
import { afterEach, expect, test } from "vitest";
import { followAlias } from "../../../app/legacy-aliases";
import { queryClient, sessionOptions } from "../../../lib/query";
import { useLayerStore } from "../../../nav/layer-store";
import { useMapViewStore } from "../map-view";

afterEach(() => {
  queryClient.clear();
  useLayerStore.setState({ stacks: {}, motion: null });
  useMapViewStore.setState({ views: {} });
});

/** Where an older address hops (its row's one redirect). */
async function hop(href: string) {
  const url = new URL(href, "https://amp.invalid");
  try {
    await followAlias({
      pathname: url.pathname,
      searchStr: url.search,
      search: Object.fromEntries(url.searchParams),
    });
  } catch (thrown) {
    expect(isRedirect(thrown)).toBe(true);
    return (thrown as { options: { href?: string } }).options.href;
  }
  return null;
}

test("an older map address names its skill in the path, puts the rest in their stores, and keeps no query", async () => {
  const adult = { accountId: "adult", token: "t" };
  queryClient.setQueryData(sessionOptions.queryKey, adult);
  expect(
    await hop(
      "/pathways?skill=count-to-20&lesson=count-objects&topic=frac&filter=3&area=geometry",
    ),
  ).toBe("/pathways/count-to-20");
  // The skill's address is the map's screen: its lesson is the map's layer.
  expect(useLayerStore.getState().stacks["adult:/pathways"]).toEqual([
    { kind: "lesson", id: "count-objects" },
  ]);
  expect(useMapViewStore.getState().views["adult:/pathways"]).toEqual({
    topic: "frac",
    band: "3",
    area: "geometry",
  });
});

test("the old library's search lands in the map's view", async () => {
  const adult = { accountId: "adult", token: "t" };
  queryClient.setQueryData(sessionOptions.queryKey, adult);
  expect(await hop("/lessons?q=fractions")).toBe("/pathways");
  expect(useMapViewStore.getState().views["adult:/pathways"]?.topic).toBe(
    "fractions",
  );
});
