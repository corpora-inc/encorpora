import { expect, it } from "vitest";
import { mapTitleAhead, routeHead } from "../route-head";

it("the skill map's index and the old lessons address wear the map's title before anything paints", () => {
  for (const path of ["/pathways", "/pathways/", "/lessons"])
    expect(mapTitleAhead(path)).toBe("Explore Math Skills | AMP Pathways");
});

it("a skill's own page and every other screen are left to their owners", () => {
  for (const path of ["/pathways/count-to-20", "/lessons/x", "/practice", "/"])
    expect(mapTitleAhead(path)).toBeUndefined();
  // The map still owns its head once mounted: the route head has none.
  expect(routeHead("/pathways", "app")).toBeUndefined();
});
