import { afterEach, expect, test } from "vitest";
import { aliasTarget } from "../../../app/legacy-aliases";
import { queryClient, sessionOptions } from "../../../lib/query";
import { useLayerStore } from "../../../nav/layer-store";
import { useMapViewStore } from "../map-view";

afterEach(() => {
  queryClient.clear();
  useLayerStore.setState({ stacks: {}, motion: null });
  useMapViewStore.setState({ views: {} });
});

const at = (href: string) => {
  const url = new URL(href, "https://amp.invalid");
  return {
    pathname: url.pathname,
    searchStr: url.search,
    search: Object.fromEntries(url.searchParams),
  };
};

test("an older map address puts its layers and view in their stores, and names the map only", async () => {
  const adult = { accountId: "adult", token: "t" };
  queryClient.setQueryData(sessionOptions.queryKey, adult);
  const href = await aliasTarget(
    at(
      "/pathways?skill=count-to-20&lesson=count-objects&topic=frac&filter=3&area=geometry",
    ),
  );
  expect(href).toBe("/pathways");
  expect(useLayerStore.getState().stacks["adult:/pathways"]).toEqual([
    { kind: "skill", id: "count-to-20" },
    { kind: "lesson", id: "count-objects" },
  ]);
  expect(useMapViewStore.getState().views["adult:/pathways"]).toEqual({
    topic: "frac",
    band: "3",
    area: "geometry",
  });
});

test("a class map's answer page opens its student and the answer over the map", async () => {
  const teacher = { accountId: "teacher", token: "t" };
  queryClient.setQueryData(sessionOptions.queryKey, teacher);
  const student = "33333333-3333-4333-8333-333333333333";
  expect(
    await aliasTarget(at(`/school/o/classes/c/map/${student}/work/abcdef01`)),
  ).toBe("/school/o/classes/c/map");
  expect(useLayerStore.getState().stacks["/school/o/classes/c/map"]).toEqual([
    { kind: "student", id: student },
    { kind: "work", id: `${student}.abcdef01` },
  ]);
});
