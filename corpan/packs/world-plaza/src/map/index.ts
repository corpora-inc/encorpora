/**
 * src/map — the World Plaza map slice (COHESION_ITERATION §4). Pure consumers of
 * the `MapView` bundle (Seam 4): the corner minimap + the premium full-screen
 * map, plus the `MenuSectionView` factory for the menu's Map tab.
 */

export { mountMinimap, type MinimapHandle, type MinimapOptions } from "./minimap"
export {
  openFullMap,
  createMapSection,
  type FullMapOptions,
  type FullMapModalHandle,
} from "./fullMap"
