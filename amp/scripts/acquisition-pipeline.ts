/** Development entry for the acquisition pipeline command (`npm run
 * acquisition:pipeline -- report | apply | apply-batch`). Production runs the
 * bundled `src/acquisition/cli.mjs` on plain node instead: see
 * `src/acquisition/cli.ts`. */
import { runCli } from "../src/acquisition/cli.js";

await runCli();
