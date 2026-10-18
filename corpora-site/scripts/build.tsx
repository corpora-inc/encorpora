import { loadConfig } from "../src/config.js";
import { buildSite } from "../src/build.js";
await buildSite(await loadConfig());
