import type { Scene } from "./spec";

/** Reference scenes for the scenes-v2 components (circle graph, thermometer,
 * ruler, coins, stepped cube solid): typical and boundary cases, drawn by
 * the gallery at every width and theme and on print pages. */
const one = (element: Scene["elements"][number], extra: Partial<Scene> = {}) =>
  ({ v: 1, elements: [element], ...extra }) as Scene;

export const sceneV2Cases: { name: string; scene: Scene; reveal?: boolean }[] =
  [
    {
      name: "Circle graph: sectors labeled inside with percents",
      scene: one(
        {
          type: "circleGraph",
          id: "graph",
          sectors: [
            { label: "Walk", value: 35, text: "35%" },
            { label: "Bus", value: 30, text: "30%" },
            { label: "Car", value: 20, text: "20%" },
            { label: "Bike", value: 15, text: "15%" },
          ],
        },
        { title: "How students travel to school" },
      ),
    },
    {
      name: "Circle graph: thin sectors use the numbered key",
      scene: one(
        {
          type: "circleGraph",
          id: "graph",
          sectors: [
            { label: "Soccer", value: 45, text: "162°" },
            { label: "Tennis", value: 5, text: "18°" },
            { label: "Swimming", value: 30, text: "108°" },
            { label: "Running", value: 10, text: "36°" },
            { label: "Other", value: 10, text: "36°", derived: true },
          ],
        },
        { title: "Favorite sport", maxHeight: 420 },
      ),
    },
    {
      name: "Circle graph: counts, one value left out",
      scene: one(
        {
          type: "circleGraph",
          id: "graph",
          sectors: [
            { label: "Dog", value: 50, text: "60" },
            { label: "Cat", value: 25, text: "30" },
            { label: "Fish", value: 25 },
          ],
        },
        { title: "Favorite pet of 120 families" },
      ),
    },
    {
      name: "Thermometer: Fahrenheit, reading to find",
      scene: one(
        {
          type: "thermometer",
          id: "t",
          unit: "F",
          min: 30,
          max: 90,
          minor: 2,
          major: 10,
          reading: 64,
          derived: true,
        },
        { maxHeight: 420 },
      ),
    },
    {
      name: "Thermometer: Celsius below zero",
      scene: one(
        {
          type: "thermometer",
          id: "t",
          unit: "C",
          min: -20,
          max: 20,
          minor: 1,
          major: 5,
          reading: -7,
        },
        { maxHeight: 420 },
      ),
    },
    {
      name: "Ruler: inches in eighths, a pencil to measure",
      scene: one({
        type: "ruler",
        id: "r",
        unit: "in",
        length: 4,
        parts: 8,
        object: { from: 0, to: 27, shape: "pencil" },
      }),
    },
    {
      name: "Ruler: centimeters and millimeters, a ribbon from 2 cm",
      scene: one({
        type: "ruler",
        id: "r",
        unit: "cm",
        length: 6,
        parts: 10,
        style: "tape",
        object: { from: 20, to: 57, shape: "ribbon", label: "ribbon" },
      }),
    },
    {
      name: "Coins: which picture shows a dime",
      scene: one({
        type: "coins",
        id: "c",
        coins: [
          { coin: "quarter", label: "A" },
          { coin: "dime", label: "B" },
          { coin: "penny", label: "C" },
        ],
      }),
    },
    {
      name: "Coins: one coin to name",
      scene: one({ type: "coins", id: "c", coins: [{ coin: "nickel" }] }),
    },
    {
      name: "Coins: a mixed handful in rows",
      scene: one({
        type: "coins",
        id: "c",
        perRow: 5,
        coins: (
          [
            "quarter",
            "quarter",
            "dime",
            "dime",
            "dime",
            "nickel",
            "nickel",
            "penny",
            "penny",
            "penny",
          ] as const
        ).map((coin) => ({ coin })),
      }),
    },
    {
      name: "Stepped solid of unit cubes",
      scene: one({
        type: "isoSolid",
        id: "s",
        solid: { form: "steps", width: 3, columns: [4, 4, 3, 2, 1] },
      }),
    },
  ];
