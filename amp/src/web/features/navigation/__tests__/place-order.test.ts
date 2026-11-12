import { expect, test } from "vitest";
import { orderPlaces, type PlaceEntry } from "../PlaceSwitcher";

const entry = (id: PlaceEntry["id"], name = id): PlaceEntry =>
  ({ id, name, detail: "", path: id }) as PlaceEntry;

test("own practice, family, then each school followed by the classes taught there", () => {
  const ordered = orderPlaces(
    [entry("home"), entry("me"), entry("school:a"), entry("school:b")],
    [entry("class:b:1"), entry("class:a:2"), entry("class:c:3")],
  );
  expect(ordered.map((place) => place.id)).toEqual([
    "me",
    "home",
    "school:a",
    "class:a:2",
    "school:b",
    "class:b:1",
    // A taught class whose school isn't listed still shows, last.
    "class:c:3",
  ]);
});
