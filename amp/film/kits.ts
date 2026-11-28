/**
 * The products whose lesson films this kit makes. AMP's films teach a problem
 * type and draw its figures; another product brings its own screenplays, its
 * own page (theme and figure mount) and no AMP problem facts.
 *
 *   npx tsx film/make.ts <id> --kit crane
 */
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type KitName = "amp" | "crane";
export type Kit = {
  name: KitName;
  /** Where the screenplays are: `<lessons>/<id>.json`. */
  lessons: string;
  /** The page the renderer loads, as a path on the dev server (root `amp/`). */
  page: string;
  /** Directories outside `amp/` the page imports from. */
  allow: string[];
  /** The film teaches an AMP problem type: its facts and example figure come from the template. */
  facts: boolean;
};

const AMP = fileURLToPath(new URL("..", import.meta.url));
const REPO = join(AMP, "..");

export function kitOf(name = "amp"): Kit {
  if (name === "amp") return { name, lessons: join(AMP, "film", "lessons"), page: "/film/page.tsx", allow: [], facts: true };
  if (name === "crane") {
    const dir = join(REPO, "crane", "film");
    return { name, lessons: join(dir, "lessons"), page: `/@fs${join(dir, "page.tsx")}`, allow: [join(REPO, "crane")], facts: false };
  }
  throw new Error(`--kit is amp or crane, not "${name}"`);
}
