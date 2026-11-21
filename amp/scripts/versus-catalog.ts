/**
 * Rewrite src/versus/catalog.json, the hub's list, from the pages: each
 * page's slug, name, category and line, by the hub's category order and then
 * by name. The pages are the source; nobody edits catalog.json by hand.
 * The pages must pass `npm run versus:check -- <slug>` first.
 *
 *     npm run versus:catalog
 */
import { writeVersusCatalog } from "../src/versus/files";

try {
  const catalog = writeVersusCatalog();
  console.log(
    `Wrote src/versus/catalog.json: ${catalog.length} comparison${catalog.length === 1 ? "" : "s"}.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
