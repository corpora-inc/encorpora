/* The level view, as parts that take plain numbers and fetch nothing:
   one learner's level (`LevelRange`), a class's rows (`LevelBar` on a shared
   `fitScale`), and the axis under them (`LevelAxis`). */
export { LevelRange, LevelRangeStart, type LevelRangeArea } from "./LevelRange";
export { LevelAxis, LevelBar } from "./LevelBar";
export { LevelPath, type PathPoint } from "./LevelPath";
export {
  fitScale,
  likelyRange,
  scaleAt,
  shortGrade,
  type Estimate,
  type RangeScale,
} from "./scale";
