/**
 * A film whose shots draw app figures from their own scene specs (a bar chart,
 * a graph) beside the template's example figure and the whiteboard. No voice:
 * words at an even pace. The frame check and film/scene-shot.test.ts play it.
 */
import { problemLesson } from "../../src/content/problem-lessons";
import { scriptSchema, type Script, type Timing } from "../schema";

/** `<template>--<variant>`: the example figure is decimal-fraction-locate's number line. */
export const SCENE_FILM_ID = "decimal-fraction-locate--scene";
export const barScene = {
  v: 1, title: "Trees by kind",
  elements: [{ type: "barChart", id: "c", bars: [{ label: "Oak", value: 3 }, { label: "Pine", value: 5 }, { label: "Maple", value: 2 }], max: 6, step: 1, unit: "Trees" }],
};
export const graphScene = {
  v: 1,
  elements: [{
    type: "graph", id: "g", x: [-1, 9], y: [-1, 10], grid: 1, tick: 2,
    lines: [{ line: { through: [[3, 2], [5, 8]] }, color: "accent" }],
    points: [{ x: 3, y: 2, label: "(3, 2)", color: "gold" }, { x: 5, y: 8, label: "(5, 8)", color: "gold" }],
    slopeTriangles: [{ from: [3, 2], to: [5, 8] }],
  }],
};
const scene = (target: string, at: string, extra: Record<string, unknown> = {}) => ({ do: "scene", at, actions: [{ do: "highlight", target }], ...extra });
export const sceneScreenplay = {
  id: SCENE_FILM_ID,
  title: "Any app figure",
  seed: "film",
  shots: [
    {
      figure: { scene: barScene },
      beats: [
        { say: "The trees are sorted into three kinds: oak, pine and maple.", do: [scene("c.bar.0", "oak"), scene("c.bar.1", "pine"), scene("c.bar.2", "maple")] },
        { say: "How many oak and pine trees are there?", do: [{ do: "problem", text: "How many oak and pine trees are there?", at: "How" }] },
        { say: "Oak has three. Pine has five.", do: [scene("c.bar.0.label", "three"), scene("c.bar.1.label", "five"), { do: "write", tex: "3+5", fresh: true, at: "Oak" }] },
        { say: "Three plus five is eight.", do: [{ do: "answer", tex: "3+5=8", at: "eight" }] },
      ],
    },
    {
      figure: { scene: graphScene },
      beats: [
        { say: "Slope measures how steep a line is.", do: [{ do: "clear", at: "Slope" }, { do: "scene", at: "Slope", dur: 1.2, actions: [{ do: "trace", target: "g.line.0" }] }, { do: "text", text: "Slope is rise over run.", at: "steep" }] },
        { say: "The line rises six and runs two.", do: [scene("g.slope.0.rise", "rises"), scene("g.slope.0.run", "runs"), { do: "write", tex: "\\frac{6}{2}", fresh: true, at: "rises" }] },
        { say: "Six over two is three.", do: [{ do: "answer", tex: "\\frac{6}{2}=3", at: "three" }] },
      ],
    },
    {
      figure: { example: true },
      beats: [
        { say: "Which point is at nine tenths?", do: [{ do: "clear", at: "Which" }, { do: "problem", text: "Which point is at $\\frac{9}{10}$?", at: "Which" }, scene("line.label.0", "point")] },
        { say: "Count nine steps from zero. That mark is B.", do: [scene("line.mark.1", "nine"), { do: "answer", tex: "B", at: "B" }] },
      ],
    },
  ],
};

/** Each word 0.36 s, 0.12 s apart; a breath between beats and shots. */
export function evenTiming(script: Script): Timing {
  let t = 0.5;
  const shots = script.shots.map((shot) => {
    const beats = shot.beats.map((b) => {
      const words = b.say.split(/\s+/).map((text) => {
        const w = { text, start: t, end: t + 0.36 };
        t += 0.48;
        return w;
      });
      t += 0.6;
      return { start: words[0]!.start, end: words[words.length - 1]!.end, words };
    });
    t += 0.45;
    return beats;
  });
  return { duration: t + 1.8, shots };
}

/** What the live player and the renderer load: the screenplay, its timing and the template's example figure. */
export function sceneFilm(raw: unknown = sceneScreenplay) {
  const script = scriptSchema.parse(raw);
  const figure = problemLesson("decimal-fraction-locate", script.seed ?? "film").example.figure ?? null;
  return { id: script.id, title: script.title, script, timing: evenTiming(script), figure };
}
