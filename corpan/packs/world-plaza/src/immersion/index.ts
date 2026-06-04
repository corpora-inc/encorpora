/**
 * World Plaza immersion — the per-Track "how much native shows" seam
 * (IMMERSION_TOGGLE). `createImmersionResolver` is the pure producer of the
 * `ImmersionResolver` contract; the store persists the per-Track level; the toggle
 * is the control. Immersion ON = TARGET language everywhere.
 */
export {
  createImmersionResolver,
  immersionToggleApplies,
  nextImmersionLevel,
  type Immersion,
  type ImmersionResolver,
  type CreateImmersionArgs,
} from "./immersion"

export { createImmersionStore, immersionStore, type ImmersionStore } from "./store"

export {
  mountImmersionToggle,
  type ImmersionToggleOptions,
  type ImmersionToggleHandle,
} from "./immersionToggle"
