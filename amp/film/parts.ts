/**
 * The part names a `scene` action can target in an app figure, so an author
 * can find them. Reads a scene spec, `{"scene": ...}` or a whole shot
 * (`{"figure": {"scene": ...}}`) from a JSON file or stdin:
 *   npx tsx film/parts.ts shot.json
 *   echo '{"v":1,"elements":[...]}' | npx tsx film/parts.ts
 */
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { layoutScene, sceneSchema } from "../src/math/scene";

/** Every named part, in drawing order, and the crowded optional labels the layout left out. */
export function partsOf(input: unknown): { parts: string[]; dropped: string[] } {
  const o = input as { figure?: { scene?: unknown }; scene?: unknown } | null;
  const spec = o?.figure?.scene ?? o?.scene ?? input;
  const parsed = sceneSchema.safeParse(spec);
  if (!parsed.success)
    throw new Error(`Not a scene spec:\n- ${parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n- ")}`);
  const layout = layoutScene(parsed.data, { reveal: true });
  return { parts: [...new Set(layout.items.map((d) => d.id).filter(Boolean))], dropped: layout.dropped };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  const { parts, dropped } = partsOf(JSON.parse(readFileSync(file ?? 0, "utf8")));
  console.log(parts.join("\n"));
  if (dropped.length) console.log(`\nleft out (crowded): ${dropped.join(", ")}`);
}
