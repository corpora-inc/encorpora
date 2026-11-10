import { grade4GeometryTemplates } from "../src/math/grade4-geometry-practice";
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  generatedProblemSchema,
  type GeneratedProblem,
} from "../src/math/contracts";
import { generateProblem, templates } from "../src/math/engine";
import { layoutScene, type Drawn } from "../src/math/scene";
import { angleClassifyAxes } from "../src/math/angle-practice";
import { shapeSidesAxes } from "../src/math/multiselect-figure-practice";
import { chooseAxes, isLegacy } from "../src/math/variation/axes";
import { legacySurface } from "./fixtures/legacy-surface";

/**
 * Independent checks for the grade-4 geometry types. The answer is recomputed
 * from the drawn rays, vertices, side labels and rectangle dimensions. Nothing
 * here calls the generators' own classifiers.
 *
 * The two hash lists are sha256(JSON.stringify(legacySurface(problem))) for
 * seeds legacy-0..29, taken before the reflex and angle-property axes existed.
 * A seed is pinned only when its axis value is still the legacy value.
 */

const ANGLE_LEGACY = [
  "4f191ea4484d237557f1be3ed5ee922e449f2010ac2c0c1b4cf5fce4e886f8c6",
  "2c3f9c037908e32b1ee744cf5065e5dbca83db8829bcbab5d2d20eb248e1ffd0",
  "1e9c36b01365e9494e5e729554a8d52e5989faa35885c58dd8428306888196b9",
  "2eec309efcd8ea742e0d0fdc59a8ef3e70dd0025980a50f7edc27a5f87ae44ca",
  "db52a361f39aa997f84fb20f777791a26b07d2f883febaa927eb6e72f447de37",
  "87fe43a07f1e52ac47bcbecb6efa454ee5ee69f771f428ea6edefe15a6f274da",
  "a89542adc8423151dfec2f5913d725d88bff5915c49ca0534aca3617c55f7143",
  "d3e8d97104ff38355570e0340d9c227269f2b1748355c2e2f13d99f3c4034800",
  "ece9134992859f285ebc364f105efda746396419fa33dd21aa0ee5c4a3184e07",
  "2d865b623e8b3ff5af2eb2d1999cac0841f34addcb4c5d0686cab4fcdc39c81d",
  "bf0b95be49c80ce2afacb1e62e4709995d90682cd164fa26026eb47fd8c13173",
  "aea5876276b8f057c864e4fdd4637d224a970cd1671b240732c927f10dbc373f",
  "169a7ee061511adeeb83dae75b8896e448db6fea2952083d03379a0721325c6f",
  "211bd2e15b98fad5c373fd663d2d59fe04de83ea70dd2cc1f9ed7b4b5803f99a",
  "7868305555df6273d68b0a1af2e2f5d6b7d152b4ae2bbbc5281bead14e1ee005",
  "d34d989c51c8ddbec185b725d4c5ed4dffe20a398f4b5f2f054f86ee7183f9a5",
  "1e3513cf7f735795b4f989c76f3cad0e74ccae0702a263f36268c37c483f192c",
  "cea44226f4a2a228e4f24702e5daec15b83cb39ed987b09a5068e8c38dd22bc7",
  "4265ab260be643bf0bec7d9199576b55b7f5d0eb4038e2570ecc8cc60eb27160",
  "60cda8a074a787a89e07e53af92bf6b5243e48630e3bc8ab247f6fe1f707f59c",
  "c452076178bde8d121dc46b2d128e84653e8b8125cf207d8daa561f7f43fe6fb",
  "1b6421baac15627edbdabcb166a359915e59ee79a49f92d909b9bd426377cbea",
  "663d40b231448dd1231d695af75c59731d9e3e3f4060abcc5b7c16907a65d4c0",
  "8fc48eeb4b151dbdbb27b8b4177e666cede88c41082e61824e9688fcfcbe701b",
  "e143a899d3b1376545bb0f588c1c1ea0a4279de3cdae034a6acda7bee5568bff",
  "e04c2dadd985b27d91b1b18240121deaf118eb87901927e9abd322ae8b7adbce",
  "444c5bca0d89749c5da0d506cee5a52178b7717feda3d72db73c752982d91a3e",
  "c6f22343c47fd760ea0a54a354b353a7f91c8c77140c721323af886c241cba27",
  "dade386544daedfe77e059fcad4f470b7ebb9d72a482693cddf4eb6f9e2f4b38",
  "82556c6b08c31686647a824b7aed61a2142ceddf5f896efacf01978590b4acc6",
];

const SHAPE_LEGACY = [
  "37cf40ac59f7ceda3a4ed3abb95eb08b2ff034b70f9cd18d6b1b7606572b5fd5",
  "05d4703a04041914be0e7e9bf9a33d80ca3c8b91bd3295dd010fcca23ab825be",
  "c91ce7f96df2da38965da0feaee63ff56465532db9d82b67159007877876901a",
  "489df85e456b509305e8028102a30862d25f700668c9ee938951ad7dfa42d312",
  "65199239c4afd166d402764245f97652ea2b1d31d101b8a6d65479aea6bf98da",
  "14bdd3bdd0c511374bc021da9730ae4609d32e93d9762ea22369020e7634e7b9",
  "8fdb236fd263369003e000ec91243768a5e270dedcbaf0769bfa2119b0289889",
  "10797f404831c4bf62e3d968a63aaa1004876076972b63041a1469052fbb3efa",
  "d7c3565c46ad816fb4aa5ab663299a799bfd1c9dafe93861c43bef789d5c65cb",
  "24c5381b30d16e386153de2d90c3c9f495494c18ef6ca7b347445cd55efe6513",
  "d7300179538e6a1bdec7f3eec7da05ddba86d4dea1efab4e1f03764dbeb4f0d9",
  "2b045b33f872c2b65f0fc94a727dbffd4cae4cc70c467da991b83c9e09b72122",
  "b7e769443d918560089ca3d08ed83c2d7220139760f6d21d455519bf94463720",
  "5ee8702e9c0b9242471bbf64b01b6040f2cfb17653036b685268e89409d7f8dc",
  "bec4e449bed8e6350bad1f706c5635115b51c75a8e1561eec2f88ae5a4863a31",
  "5c3b55344d03c85436af315469601cf496d63686f4bf47980c1f8addf7288dea",
  "b25bb69a2efeb4af645b820c7fe27a9dd1c50db1cfc54ae2dcb6499b559e8bee",
  "fb8890a92d36d4a71d16b706cf5aeec1b6ce82777fdc75e5f832b47d6ce4193d",
  "cd914838d586e7a5c05dc977a71880f57044f38b879639c8cbd8758b1160e128",
  "c0239fad0c39801beb998135acd131c38e1c3bb32dde6532e5b78f945491caeb",
  "b09a3a5be54649f4f74e32035f07abb0aff007c14544495c058df35d11cf12e8",
  "99d05bd3b01a552d1a3691740afc833b6341e9734c5322fb6f1c418fb7872544",
  "472962b305091e6f2b82660aeea4169196db6b9506b941c1748af6c41a888aca",
  "bc1f12a5e6efa59597e25c9d013359e46256b3cefde24ab401c94addb29d313e",
  "7f4a9d024819cf0a18aa7171017690f9f73a8ab71b085f79c78bb78174e63041",
  "aa743df95cebd78ce8def30b75b0cd11786c642ad3556b2490ad10af8104b78d",
  "e2163ddeb8a9f31676f67012a60a2d935b5b6ddf9e4b18390da1007d22e63dec",
  "24d638397309aec57ae8064a30bf8d1b9f43053edb9f043af03e96a1af2b1eb8",
  "72e91a00d54a885812debfa7d8095c2575281a50077b2edbbf785dd49f397423",
  "baeeebe813f6a3cf2b6810b4d8da9d18938d14281396c4ef48ad97e9fa5ac83c",
];

const metadata = new Map(grade4GeometryTemplates.map((t) => [t.id, t]));

const BENCHMARKS = [30, 45, 60, 90, 180];
const SEEDS = 200;

function hashOf(problem: GeneratedProblem): string {
  return createHash("sha256")
    .update(JSON.stringify(legacySurface(problem)))
    .digest("hex");
}

function span(a: number, b: number): number {
  return (((b - a) % 360) + 360) % 360;
}

function sceneOf(problem: GeneratedProblem) {
  const figure = problem.public.figure;
  assert.equal(figure?.kind, "scene");
  if (!figure || figure.kind !== "scene") throw new Error("scene");
  return figure.scene.elements;
}

type SceneEl = ReturnType<typeof sceneOf>[number];

function one<K extends SceneEl["type"]>(
  items: readonly SceneEl[],
  type: K,
): Extract<SceneEl, { type: K }> {
  const found = items.filter(
    (item): item is Extract<SceneEl, { type: K }> => item.type === type,
  );
  assert.equal(found.length, 1, type);
  return found[0]!;
}

function optionId(problem: GeneratedProblem, label: string): string {
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice");
  const found = response.options.filter((option) => option.label === label);
  assert.equal(found.length, 1, label);
  return found[0]!.id;
}

function rayDegrees(to: readonly number[]): number {
  const wrapped =
    ((((Math.atan2(to[1]!, to[0]!) * 180) / Math.PI) % 360) + 360) % 360;
  const nearest = Math.round(wrapped) % 360;
  const gap = Math.min(
    Math.abs(wrapped - nearest),
    360 - Math.abs(wrapped - nearest),
  );
  assert.ok(gap < 0.05, `ray at ${wrapped}`);
  return nearest;
}

function interiors(points: readonly (readonly number[])[]): number[] {
  const n = points.length;
  let area = 0;
  for (let i = 0; i < n; i++) {
    const q = points[(i + 1) % n]!;
    area += points[i]![0]! * q[1]! - q[0]! * points[i]![1]!;
  }
  const orient = area >= 0 ? 1 : -1;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[(i + n - 1) % n]!;
    const b = points[i]!;
    const c = points[(i + 1) % n]!;
    const ix = b[0]! - a[0]!;
    const iy = b[1]! - a[1]!;
    const ox = c[0]! - b[0]!;
    const oy = c[1]! - b[1]!;
    const turn = Math.atan2(orient * (ix * oy - iy * ox), ix * ox + iy * oy);
    out.push(180 - (turn * 180) / Math.PI);
  }
  return out;
}

function sideLengths(points: readonly (readonly number[])[]): number[] {
  return points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    return Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!);
  });
}

function parallelPairs(points: readonly (readonly number[])[]): number {
  const dirs = points.map((p, i) => {
    const q = points[(i + 1) % points.length]!;
    const n = Math.hypot(q[0]! - p[0]!, q[1]! - p[1]!);
    return [(q[0]! - p[0]!) / n, (q[1]! - p[1]!) / n] as const;
  });
  let pairs = 0;
  for (let i = 0; i < dirs.length; i++)
    for (let j = i + 1; j < dirs.length; j++) {
      const [ax, ay] = dirs[i]!;
      const [bx, by] = dirs[j]!;
      if (Math.abs(ax * by - ay * bx) < 1e-3) pairs++;
    }
  return pairs;
}

function shapePoints(problem: GeneratedProblem): number[][] {
  const shapes = one(sceneOf(problem), "shapes");
  assert.equal(shapes.items.length, 1);
  const piece = shapes.items[0]!.pieces[0]!;
  assert.equal(piece.type, "polygon");
  if (piece.type !== "polygon") throw new Error("polygon");
  return piece.points.map((p) => [p[0], p[1]]);
}

type SideClass = "scalene" | "isosceles" | "equilateral";
type AngleClass = "acute" | "right" | "obtuse";

function triangleClasses(points: readonly (readonly number[])[]): {
  sides: SideClass;
  angles: AngleClass;
} {
  const lengths = sideLengths(points);
  const close = (a: number, b: number) =>
    Math.abs(a - b) / Math.max(a, b) < 0.02;
  const equalPairs = [
    close(lengths[0]!, lengths[1]!),
    close(lengths[1]!, lengths[2]!),
    close(lengths[0]!, lengths[2]!),
  ].filter(Boolean).length;
  assert.notEqual(equalPairs, 2);
  const sides: SideClass =
    equalPairs === 3
      ? "equilateral"
      : equalPairs === 1
        ? "isosceles"
        : "scalene";
  const angles = interiors(points);
  const right = angles.some((a) => Math.abs(a - 90) <= 0.5);
  assert.ok(right || angles.every((a) => Math.abs(a - 90) >= 15));
  const kind: AngleClass = right
    ? "right"
    : Math.max(...angles) > 90.5
      ? "obtuse"
      : "acute";
  return { sides, angles: kind };
}

function quadName(points: readonly (readonly number[])[]): string {
  assert.equal(points.length, 4);
  const angles = interiors(points);
  const lengths = sideLengths(points);
  const rights = angles.filter((a) => Math.abs(a - 90) < 0.5).length;
  const equal = Math.max(...lengths) / Math.min(...lengths) < 1.02;
  const pairs = parallelPairs(points);
  if (rights === 4 && equal) return "square";
  if (rights === 4) return "rectangle";
  if (equal && rights === 0 && pairs >= 2) return "rhombus";
  if (pairs >= 2 && rights === 0 && !equal) return "parallelogram";
  if (pairs === 1) return "trapezoid";
  throw new Error("unnamed quadrilateral");
}

function evalArith(text: string, env: Record<string, number>): number {
  let body = text.trim();
  if (body.startsWith("$") && body.endsWith("$")) body = body.slice(1, -1);
  body = body.replaceAll("\\times", "*").replaceAll(" ", "");
  for (const name of Object.keys(env).sort((a, b) => b.length - a.length))
    body = body.replaceAll(
      new RegExp(`(?<![A-Za-z])${name}(?![A-Za-z])`, "g"),
      `(${env[name]})`,
    );
  body = body.replaceAll(/(\d)\(/g, "$1*(").replaceAll(")(", ")*(");
  assert.equal(/[A-Za-z\\]/.test(body), false, `${text} -> ${body}`);
  assert.match(body, /^[0-9+*()\-]+$/);
  let i = 0;
  const expr = (): number => {
    let value = term();
    while (i < body.length && (body[i] === "+" || body[i] === "-")) {
      const op = body[i]!;
      i++;
      const right = term();
      value = op === "+" ? value + right : value - right;
    }
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (i < body.length && body[i] === "*") {
      i++;
      value *= factor();
    }
    return value;
  };
  const factor = (): number => {
    assert.ok(i < body.length);
    if (body[i] === "(") {
      i++;
      const value = expr();
      assert.equal(body[i], ")");
      i++;
      return value;
    }
    const match = /^\d+/.exec(body.slice(i));
    assert.ok(match);
    i += match![0].length;
    return Number(match![0]);
  };
  const value = expr();
  assert.equal(i, body.length);
  return value;
}

function equationHolds(label: string, unknown: number): boolean {
  assert.ok(label.startsWith("$") && label.endsWith("$"));
  const sides = label.slice(1, -1).split("=");
  assert.equal(sides.length, 2);
  return (
    evalArith(sides[0]!, { x: unknown }) ===
    evalArith(sides[1]!, { x: unknown })
  );
}

function protractorAnswer(problem: GeneratedProblem): string {
  const prompt = problem.public.prompt;
  assert.match(prompt, /ray \$BA\$/i);
  const degrees = [...prompt.matchAll(/\$(\d+)\^\\circ\$/g)].map((m) =>
    Number(m[1]),
  );
  assert.equal(degrees.length, 1);
  const k = degrees[0]!;
  assert.ok(k >= 5 && k <= 175 && k % 5 === 0 && k !== 90);
  const items = sceneOf(problem);
  const tool = one(items, "protractor");
  assert.ok(tool.labels);
  assert.equal(tool.labels[0], "A");
  assert.equal(tool.labels[1], "B");
  const base = tool.rays[0];
  assert.ok(base === 0 || base === 180);
  const rays = new Map<string, number>([[tool.labels[2], tool.rays[1]]]);
  for (const item of items) {
    if (item.type === "segment" && item.id?.startsWith("ray")) {
      const letter = item.id.slice(3);
      assert.equal(rays.has(letter), false);
      assert.deepEqual(item.from, [0, 0]);
      rays.set(letter, rayDegrees(item.to));
    }
  }
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice");
  assert.deepEqual(
    [...rays.keys()].sort(),
    response.options.map((option) => option.label.replaceAll("$", "")).sort(),
  );
  const measure = (direction: number) =>
    base === 0 ? direction : 180 - direction;
  const onTarget = [...rays].filter(
    ([, direction]) => measure(direction) === k,
  );
  const onWrong = [...rays].filter(
    ([, direction]) => measure(direction) === 180 - k,
  );
  assert.equal(onTarget.length, 1);
  assert.equal(onWrong.length, 1);
  assert.equal(response.options.length, 4);
  return optionId(problem, `$${onTarget[0]![0]}$`);
}

function adjacentAnswer(problem: GeneratedProblem): string {
  const patterns = [
    /Angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ measures (\d+)°\. The measure of angle \$([A-Z]{3})\$ is \$x\$ degrees\./,
    /The whole angle \$([A-Z]{3})\$ is (\d+)°\. The known part \$([A-Z]{3})\$ is (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\./,
    /Angle \$([A-Z]{3})\$ measures (\d+)°\. Inside it, angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\./,
    /Start from angle \$([A-Z]{3})\$, which measures (\d+)°\. Angle \$([A-Z]{3})\$ measures (\d+)°\. The measure of angle \$([A-Z]{3})\$ is \$x\$ degrees\./,
    /Angle \$([A-Z]{3})\$ measures (\d+)°\. Inside it, the adjacent angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\./,
    /Two adjacent angles make angle \$([A-Z]{3})\$, which measures (\d+)°\. Angle \$([A-Z]{3})\$ measures (\d+)°\. Angle \$([A-Z]{3})\$ is \$x\$ degrees\./,
    /(?:The ramp rises from the floor at|The ladder meets the ground at|The door opens from the wall at|The gate opens from the fence at|The roof rises from the top of the wall at|The pizza slice opens at) angle \$([A-Z]{3})\$, which measures (\d+)°\. (?:The brace|The strut|One cut) splits it into angle \$([A-Z]{3})\$ of (\d+)° and angle \$([A-Z]{3})\$ of \$x\$ degrees\./,
  ];
  const found = patterns
    .map((pattern) => problem.public.prompt.match(pattern))
    .find((match) => match);
  assert.ok(found, problem.public.prompt);
  const wholeName = found![1]!;
  const whole = Number(found![2]);
  const knownName = found![3]!;
  const known = Number(found![4]);
  const missingName = found![5]!;
  const angle = one(sceneOf(problem), "angle");
  assert.ok(angle.labels);
  const [d0, d1, d2] = angle.rays;
  const drawn = [span(d0!, d1!), span(d1!, d2!), span(d0!, d2!)];
  assert.ok(Math.abs(drawn[0]! + drawn[1]! - drawn[2]!) < 1e-3);
  assert.ok(drawn[2]! <= 180 + 1e-3);
  const [a, c, d] = angle.labels.ends;
  const b = angle.labels.vertex;
  const names = new Map<string, number>([
    [`${a}${b}${c}`, drawn[0]!],
    [`${c}${b}${d}`, drawn[1]!],
    [`${a}${b}${d}`, drawn[2]!],
  ]);
  assert.equal(wholeName, `${a}${b}${d}`);
  assert.ok(Math.abs(names.get(wholeName)! - whole) < 1e-3);
  assert.ok(Math.abs(names.get(knownName)! - known) < 1e-3);
  assert.ok(Math.abs(names.get(missingName)! - (whole - known)) < 1e-3);
  const response = problem.public.response;
  assert.equal(response.kind, "choice");
  if (response.kind !== "choice") throw new Error("choice");
  const unknown = whole - known;
  const trueForms = new Set([
    `$x + ${known} = ${whole}$`,
    `$${whole} - ${known} = x$`,
  ]);
  const trueOptions = response.options.filter((option) =>
    equationHolds(option.label, unknown),
  );
  assert.equal(trueOptions.length, 1);
  assert.ok(trueForms.has(trueOptions[0]!.label));
  const added = `$${whole} + ${known} = x$`;
  assert.ok(response.options.some((option) => option.label === added));
  assert.equal(equationHolds(added, unknown), false);
  assert.equal(problem.public.prompt.includes(trueOptions[0]!.label), false);
  return trueOptions[0]!.id;
}

function benchmarkAnswer(problem: GeneratedProblem): {
  id: string;
  nearest: number;
  gap: number;
} {
  assert.match(problem.public.prompt, /benchmark/i);
  assert.equal(/\d/.test(problem.public.prompt), false);
  const angle = one(sceneOf(problem), "angle");
  assert.equal(angle.rays.length, 2);
  const marks = angle.marks ?? [];
  assert.ok(marks.length > 0);
  assert.equal(
    marks.some((mark) => mark.clockwise || mark.measure),
    false,
  );
  const measure = span(angle.rays[0]!, angle.rays[1]!);
  assert.ok(measure <= 180 + 1e-3);
  const distances = BENCHMARKS.map((b) => [Math.abs(measure - b), b] as const);
  const best = Math.min(...distances.map(([gap]) => gap));
  const nearest = distances.filter(([gap]) => Math.abs(gap - best) < 1e-6);
  assert.equal(nearest.length, 1);
  assert.ok(best <= 10);
  assert.ok(distances.every(([gap, b]) => b === nearest[0]![1] || gap > 10));
  return {
    id: optionId(problem, `$${nearest[0]![1]}^\\circ$`),
    nearest: nearest[0]![1],
    gap: best,
  };
}

function triangleAnswer(problem: GeneratedProblem): string {
  assert.match(problem.public.prompt, /tick marks/i);
  const found = triangleClasses(shapePoints(problem));
  const response = problem.public.response;
  assert.equal(response.kind, "multi-part-choice");
  if (response.kind !== "multi-part-choice") throw new Error("parts");
  const out: Record<string, string> = {};
  for (const blank of response.blanks) {
    const label = blank.id === "sides" ? found.sides : found.angles;
    const match = blank.options.filter((option) => option.label === label);
    assert.equal(match.length, 1);
    out[blank.id] = match[0]!.id;
  }
  return JSON.stringify(out);
}

function quadrilateralAnswer(problem: GeneratedProblem): string {
  assert.match(problem.public.prompt, /most exact name/);
  assert.match(problem.public.prompt, /quadrilateral/);
  const name = quadName(shapePoints(problem));
  assert.equal(problem.public.prompt.toLowerCase().includes(name), false);
  return optionId(problem, name);
}

function compositeAnswer(problem: GeneratedProblem): string {
  const figure = problem.public.figure;
  assert.equal(figure?.kind, "measured-polygon");
  if (!figure || figure.kind !== "measured-polygon") throw new Error("polygon");
  assert.equal(figure.sides.length, figure.vertices.length);
  assert.ok(figure.sides.every((side) => side !== null));
  figure.sides.forEach((side, i) => {
    const q = figure.vertices[(i + 1) % figure.vertices.length]!;
    const dist = Math.hypot(
      q[0] - figure.vertices[i]![0],
      q[1] - figure.vertices[i]![1],
    );
    assert.ok(Math.abs(side! - dist) < 1e-9);
  });
  for (const height of figure.heights) {
    const dist = Math.hypot(
      height.to[0] - height.from[0],
      height.to[1] - height.from[1],
    );
    assert.ok(Math.abs(height.value - dist) < 1e-9);
  }
  let signed = 0;
  for (let i = 0; i < figure.vertices.length; i++) {
    const q = figure.vertices[(i + 1) % figure.vertices.length]!;
    signed += figure.vertices[i]![0] * q[1] - q[0] * figure.vertices[i]![1];
  }
  signed /= 2;
  assert.ok(signed > 0);
  const prompt = problem.public.prompt;
  const asksPerimeter = prompt.includes("perimeter");
  const asksArea = /\barea\b/.test(prompt);
  assert.equal(asksPerimeter, !asksArea);
  const nouns: Record<string, string> = {
    cm: "centimeters",
    m: "meters",
    ft: "feet",
    in: "inches",
  };
  assert.ok(prompt.includes(nouns[figure.unit]!), figure.unit);
  const value = asksPerimeter
    ? figure.sides.reduce((sum, side) => sum + side!, 0)
    : signed;
  assert.ok(Math.abs(value - Math.round(value)) < 1e-6);
  return String(Math.round(value));
}

function formulaAnswer(problem: GeneratedProblem): string {
  const figure = problem.public.figure;
  assert.equal(figure?.kind, "measure-rectangle");
  if (!figure || figure.kind !== "measure-rectangle")
    throw new Error("rectangle");
  assert.ok(figure.width && figure.height);
  const length = figure.width.value;
  const width = figure.height.value;
  assert.ok(figure.width.unit === "cm" || figure.width.unit === "m");
  assert.equal(figure.width.unit, figure.height.unit);
  assert.notEqual(length, width);
  const area = length * width;
  const around = 2 * (length + width);
  assert.notEqual(area, around);
  assert.notEqual(area, length + width);
  const prompt = problem.public.prompt;
  const target = prompt.includes("equal the perimeter")
    ? around
    : prompt.includes("equal the area")
      ? area
      : NaN;
  assert.ok(Number.isFinite(target));
  assert.equal(
    prompt.includes("equal the perimeter") && prompt.includes("equal the area"),
    false,
  );
  const response = problem.public.response;
  assert.equal(response.kind, "multi-select");
  if (response.kind !== "multi-select") throw new Error("multi");
  const truths = response.options.map(
    (option) => evalArith(option.label, { l: length, w: width }) === target,
  );
  const correct = response.options.filter((_, i) => truths[i]).map((o) => o.id);
  assert.equal(correct.length, response.selectionCount);
  assert.ok(correct.length >= 2 && correct.length < response.options.length);
  if (target === around) {
    for (const label of ["$l + w + l + w$", "$2l + 2w$", "$2(l + w)$"])
      assert.equal(
        truths[response.options.findIndex((option) => option.label === label)],
        true,
        label,
      );
    const product = response.options.findIndex(
      (option) => option.label === "$l \\times w$",
    );
    assert.ok(product >= 0);
    assert.equal(truths[product], false);
  } else {
    for (const label of ["$l \\times w$", "$w \\times l$"])
      assert.equal(
        truths[response.options.findIndex((option) => option.label === label)],
        true,
        label,
      );
  }
  return JSON.stringify([...correct].sort());
}

function independent(problem: GeneratedProblem): string {
  switch (problem.public.templateId) {
    case "protractor-ray-choice":
      return protractorAnswer(problem);
    case "adjacent-angle-equation":
      return adjacentAnswer(problem);
    case "angle-benchmark-estimate":
      return benchmarkAnswer(problem).id;
    case "triangle-sides-angles-blanks":
      return triangleAnswer(problem);
    case "quadrilateral-attributes":
      return quadrilateralAnswer(problem);
    case "composite-rectangle-measure":
      return compositeAnswer(problem);
    case "rectangle-formula-select":
      return formulaAnswer(problem);
    default:
      throw new Error(problem.public.templateId);
  }
}

/** Same ink trim as scripts/scene-problems.ts, on the layout's em box. */
function labelHits(items: Drawn[]) {
  const labels = items.flatMap((d) => (d.k === "text" ? [d] : []));
  const ink = (d: (typeof labels)[number]) => {
    const h = d.box.y1 - d.box.y0;
    return {
      x0: d.box.x0 + 1,
      x1: d.box.x1 - 1,
      y0: d.box.y0 + h * 0.22,
      y1: d.box.y0 + h * 0.86,
    };
  };
  const hits: string[] = [];
  for (let i = 0; i < labels.length; i++)
    for (let j = i + 1; j < labels.length; j++) {
      const a = ink(labels[i]!),
        b = ink(labels[j]!);
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1)
        hits.push(`${labels[i]!.plain}/${labels[j]!.plain}`);
    }
  return hits;
}

test("protractor rays stay readable at phone and tablet widths", () => {
  for (let i = 0; i < 40; i++) {
    const problem = generateProblem("protractor-ray-choice", `scene-${i}`);
    const figure = problem.public.figure;
    assert.equal(figure?.kind, "scene");
    if (figure?.kind !== "scene") continue;
    for (const width of [288, 340]) {
      const laid = layoutScene({ ...figure.scene, width });
      const hits = labelHits(laid.items);
      assert.deepEqual(hits, [], `scene-${i} at ${width}: ${hits.join(", ")}`);
      const degrees = laid.items.flatMap((d) =>
        d.k === "text" && d.data?.scale === "inner" ? [Number(d.plain)] : [],
      );
      assert.ok(degrees.includes(0) && degrees.includes(180), `${width}`);
      // 155° is read from 150, or from 140 and 160 when the 20° grid fits.
      assert.ok(
        degrees.includes(150) ||
          (degrees.includes(140) && degrees.includes(160)),
        `scene-${i} at ${width}: ${degrees.join(",")}`,
      );
      assert.equal(
        laid.items.filter((d) => /\.tick\.\d+$/.test(d.id)).length,
        181,
      );
    }
    const phone = layoutScene({ ...figure.scene, width: 288 });
    if (i === 0 || i === 2)
      assert.ok(phone.scale >= 115, `scene-${i} scale ${phone.scale}`);
  }
});

test("grade-4 geometry templates sit on the grade-4 skills", () => {
  for (const { id, skillId } of grade4GeometryTemplates) {
    const template = templates.find((item) => item.id === id);
    assert.ok(template, id);
    assert.equal(template.skillId, skillId);
    assert.equal(template.gradeBand, "3–5");
  }
});

test("grade-4 geometry answers match the figure over 200 seeds", () => {
  const bases = new Set<number>();
  const equationForms = new Set<string>();
  const benchmarks = new Set<number>();
  const trianglePairs = new Set<string>();
  const quadNames = new Set<string>();
  let perimeters = 0;
  const units = new Set<string>();
  const formulaKinds = new Set<string>();
  for (const id of [...metadata.keys()]) {
    for (let i = 0; i < SEEDS; i++) {
      const seed = `g4-${id}-${i}`;
      const problem = generateProblem(id, seed);
      assert.deepEqual(problem, generateProblem(id, seed));
      generatedProblemSchema.parse(problem);
      assert.equal(problem.public.skillId, metadata.get(id)!.skillId);
      assert.equal(independent(problem), problem.answer, `${id} ${seed}`);
      if (id === "protractor-ray-choice") {
        const tool = one(sceneOf(problem), "protractor");
        bases.add(tool.rays[0]);
      } else if (id === "adjacent-angle-equation") {
        const response = problem.public.response;
        assert.equal(response.kind, "choice");
        if (response.kind === "choice") {
          const keyed = response.options.find(
            (option) => option.id === problem.answer,
          );
          equationForms.add(keyed!.label.includes("-") ? "difference" : "sum");
        }
      } else if (id === "angle-benchmark-estimate") {
        benchmarks.add(benchmarkAnswer(problem).nearest);
        assert.ok(benchmarkAnswer(problem).gap >= 3);
      } else if (id === "triangle-sides-angles-blanks") {
        const found = triangleClasses(shapePoints(problem));
        trianglePairs.add(`${found.sides}/${found.angles}`);
      } else if (id === "quadrilateral-attributes") {
        quadNames.add(quadName(shapePoints(problem)));
      } else if (id === "composite-rectangle-measure") {
        const figure = problem.public.figure!;
        assert.equal(figure.kind, "measured-polygon");
        if (figure.kind === "measured-polygon") units.add(figure.unit);
        if (problem.public.prompt.includes("perimeter")) perimeters++;
      } else if (id === "rectangle-formula-select") {
        formulaKinds.add(
          problem.public.prompt.includes("perimeter") ? "perimeter" : "area",
        );
      }
    }
  }
  assert.deepEqual([...bases].sort(), [0, 180]);
  assert.deepEqual([...equationForms].sort(), ["difference", "sum"]);
  assert.deepEqual(
    [...benchmarks].sort((a, b) => a - b),
    BENCHMARKS,
  );
  assert.ok(
    trianglePairs.has("isosceles/right"),
    [...trianglePairs].join(", "),
  );
  for (const sides of ["scalene", "isosceles", "equilateral"])
    assert.ok([...trianglePairs].some((pair) => pair.startsWith(sides)));
  for (const angles of ["acute", "right", "obtuse"])
    assert.ok([...trianglePairs].some((pair) => pair.endsWith(angles)));
  assert.deepEqual([...quadNames].sort(), [
    "parallelogram",
    "rectangle",
    "rhombus",
    "square",
    "trapezoid",
  ]);
  assert.ok(perimeters >= 0.4 * SEEDS, `perimeter seeds ${perimeters}`);
  assert.deepEqual([...units].sort(), ["cm", "ft", "in", "m"]);
  assert.deepEqual([...formulaKinds].sort(), ["area", "perimeter"]);
});

function angleKind(problem: GeneratedProblem): string {
  const angle = one(sceneOf(problem), "angle");
  const clockwise = (angle.marks ?? []).some((mark) => mark.clockwise);
  const ccw = span(angle.rays[0]!, angle.rays[1]!);
  const setting = problem.variant?.axes?.setting;
  if (clockwise) {
    const measure = (360 - ccw) % 360;
    assert.ok(measure > 195 && measure < 345);
    assert.ok(Math.abs(measure - Math.round(measure)) < 1e-6);
    assert.equal(Math.round(measure) % 5, 0);
    assert.equal(problem.variant?.axes?.reflex, "reflex");
    assert.equal(
      problem.variant?.id,
      setting == null ? "reflex" : "reflex-story",
    );
    return "reflex";
  }
  assert.ok(ccw <= 180 + 1e-6);
  if (setting == null) assert.equal(problem.variant, undefined);
  else {
    assert.equal(setting, "story");
    assert.equal(problem.variant?.id, "story");
    assert.equal(problem.variant?.axes?.reflex, undefined);
  }
  const kind =
    Math.abs(ccw - 90) < 1e-6
      ? "right"
      : Math.abs(ccw - 180) < 1e-6
        ? "straight"
        : ccw < 90
          ? "acute"
          : "obtuse";
  assert.ok(
    kind === "right" || kind === "straight" || Math.abs(ccw - 90) >= 15,
  );
  return kind;
}

test("reflex angles keep the ordinary angle-classify surface byte for byte", () => {
  let legacy = 0;
  let changed = 0;
  const kinds = new Set<string>();
  for (let i = 0; i < 30; i++) {
    const seed = `legacy-${i}`;
    const axes = chooseAxes("angle-classify", seed, angleClassifyAxes);
    const ordinary = axes.reflex === "ordinary" && axes.setting === "bare";
    const problem = generateProblem("angle-classify", seed);
    const digest = hashOf(problem);
    const kind = angleKind(problem);
    kinds.add(kind);
    assert.equal(optionId(problem, kind), problem.answer);
    if (ordinary) {
      legacy++;
      assert.equal(digest, ANGLE_LEGACY[i], seed);
      assert.notEqual(kind, "reflex");
    } else {
      changed++;
      assert.notEqual(digest, ANGLE_LEGACY[i], seed);
      if (axes.reflex === "reflex") assert.equal(kind, "reflex");
      else assert.notEqual(kind, "reflex");
    }
  }
  for (let i = 30; changed === 0 && i < 200; i++) {
    const seed = `legacy-${i}`;
    const axes = chooseAxes("angle-classify", seed, angleClassifyAxes);
    if (axes.reflex === "ordinary" && axes.setting === "bare") continue;
    const problem = generateProblem("angle-classify", seed);
    if (axes.reflex === "reflex") assert.equal(angleKind(problem), "reflex");
    else assert.notEqual(angleKind(problem), "reflex");
    changed++;
  }
  for (let i = 0; i < SEEDS; i++) {
    const problem = generateProblem("angle-classify", `g4-angle-${i}`);
    const kind = angleKind(problem);
    kinds.add(kind);
    assert.equal(optionId(problem, kind), problem.answer);
    generatedProblemSchema.parse(problem);
  }
  assert.ok(legacy >= 1);
  assert.ok(changed >= 1);
  assert.ok(kinds.has("reflex"));
  for (const kind of ["acute", "right", "obtuse", "straight"])
    assert.ok(kinds.has(kind), kind);
});

type PanelEl = ReturnType<typeof sceneOf>[number];

function panelsOf(problem: GeneratedProblem) {
  const els = sceneOf(problem);
  const labels = els.filter(
    (element): element is Extract<PanelEl, { type: "text" }> =>
      element.type === "text" && /^label[A-F]$/.test(element.id ?? ""),
  );
  const xs = [...new Set(labels.map((label) => label.at[0]))].sort(
    (a, b) => a - b,
  );
  const ys = [...new Set(labels.map((label) => label.at[1]))].sort(
    (a, b) => a - b,
  );
  const cw = xs.length > 1 ? xs[1]! - xs[0]! : 2 * Math.abs(xs[0] ?? 1);
  const ch = ys.length > 1 ? ys[1]! - ys[0]! : 1e9;
  return labels.map((label) => {
    const cx = label.at[0];
    const cy = ch > 1e8 ? 0.15 : label.at[1] - 0.15 + ch / 2;
    const inside = (pt: readonly [number, number]) =>
      Math.abs(pt[0] - cx) < cw / 2 && Math.abs(pt[1] - cy) < ch / 2;
    const members = els.filter((element) => {
      if (element === label) return false;
      if (element.type === "polygon") return element.points.every(inside);
      return false;
    });
    return { letter: label.text, members };
  });
}

function angleFacts(points: readonly (readonly number[])[]) {
  const angles = interiors(points);
  for (const measure of angles) {
    const fromRight = Math.abs(measure - 90);
    assert.equal(fromRight > 0.5 && fromRight < 8, false);
    assert.ok(Math.abs(measure - 180) >= 8);
  }
  return {
    obtuse: angles.some((measure) => measure > 98 && measure < 172),
    right: angles.some((measure) => Math.abs(measure - 90) <= 0.5),
  };
}

test("shape angle properties keep the parallel and perpendicular surface", () => {
  let legacy = 0;
  let changed = 0;
  const variants = new Set<string>();
  const check = (problem: GeneratedProblem) => {
    generatedProblemSchema.parse(problem);
    const prompt = problem.public.prompt;
    const response = problem.public.response;
    assert.equal(response.kind, "multi-select");
    if (response.kind !== "multi-select") return;
    const picked = new Set(JSON.parse(problem.answer) as string[]);
    const angleAsk =
      prompt.includes("obtuse angle") || prompt.includes("no right angle");
    if (!angleAsk) {
      assert.equal(
        prompt.includes("obtuse angle") || prompt.includes("no right angle"),
        false,
      );
      variants.add(problem.variant?.id ?? "");
      return;
    }
    assert.equal(
      prompt.includes("obtuse angle") && prompt.includes("no right angle"),
      false,
    );
    const wantObtuse = prompt.includes("obtuse angle");
    for (const option of response.options) {
      const letter = option.label.match(/\$([A-F])\$/)![1]!;
      const panel = panelsOf(problem).find((item) => item.letter === letter);
      assert.ok(panel);
      const poly = panel.members.find((element) => element.type === "polygon");
      assert.ok(poly && poly.type === "polygon");
      const facts = angleFacts(poly.points);
      const holds = wantObtuse ? facts.obtuse : !facts.right;
      assert.equal(picked.has(option.id), holds, option.label);
    }
    variants.add(problem.variant?.id ?? "");
  };
  for (let i = 0; i < 30; i++) {
    const seed = `legacy-${i}`;
    const axes = chooseAxes("shape-sides-select", seed, shapeSidesAxes);
    const sides =
      axes["angle-property"] === "sides" &&
      axes.voice === "plain" &&
      (axes.wording ?? "classic") === "classic";
    const problem = generateProblem("shape-sides-select", seed);
    const digest = hashOf(problem);
    check(problem);
    const angleAsk =
      problem.public.prompt.includes("obtuse angle") ||
      problem.public.prompt.includes("no right angle");
    if (sides) {
      legacy++;
      assert.equal(digest, SHAPE_LEGACY[i], seed);
      assert.equal(problem.variant?.axes?.["angle-property"], "sides");
      assert.equal(problem.variant?.axes?.voice, undefined);
      assert.equal(angleAsk, false);
    } else {
      changed++;
      assert.notEqual(digest, SHAPE_LEGACY[i], seed);
      if (axes["angle-property"] === "sides") assert.equal(angleAsk, false);
      else assert.equal(angleAsk, true);
    }
  }
  for (let i = 30; changed === 0 && i < 200; i++) {
    const seed = `legacy-${i}`;
    if (
      isLegacy(
        shapeSidesAxes,
        chooseAxes("shape-sides-select", seed, shapeSidesAxes),
      )
    )
      continue;
    check(generateProblem("shape-sides-select", seed));
    changed++;
  }
  for (let i = 0; i < SEEDS; i++)
    check(generateProblem("shape-sides-select", `g4-shape-${i}`));
  assert.ok(legacy >= 1);
  assert.ok(changed >= 1);
  for (const id of [
    "parallel-sides",
    "perpendicular-sides",
    "obtuse-angle",
    "no-right-angle",
  ])
    assert.ok(
      variants.has(id),
      `${id} missing from ${[...variants].join(", ")}`,
    );
});
