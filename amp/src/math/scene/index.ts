/** The scene framework: spec, components, layout and the author API. */
// Registers every component (one file each, listed in components/index.ts).
import "./components";
export * from "./spec";
export {
  layoutScene,
  describeScene,
  type Layout,
  type Drawn,
  type Box,
} from "./layout";
export { typeset, typeSizes } from "./type";
export { features, evaluate } from "./functions";
export {
  elementCapability,
  sceneCapability,
  sceneCapabilitiesIn,
} from "./capability";
export type { SceneCapability } from "./layout";
