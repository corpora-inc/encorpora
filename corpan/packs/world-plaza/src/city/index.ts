/**
 * city/ — Corpan City: a large, chunked, streaming, LOD'd 3D world that scales
 * to a big map with many NPCs, built additively on the existing HD-2D engine
 * (real-3D world, 2D billboard paper-people). PUBLIC SURFACE for the orchestrator.
 *
 * Typical wiring (see the integration note in the PR description):
 *
 *   import { generateCity, mountCity } from "./city"
 *   const layout = generateCity(seed)
 *   const city = mountCity(world.scene, {
 *     layout,
 *     getCameraPos: () => world.camera.position,  // or player.getPos()
 *     palette: scene.palette,
 *   })
 *   world.onFrame((dt) => city.update(dt))
 *   const player = createPlayerController(world, cityTopology, input, avatar, city.getCollision())
 *
 * `mountCity` returns { update, getCollision, getAnchors, getSpawn, dispose }.
 * `stubCity()` returns a small fixed CityLayout for tests/early integration.
 */

export * from "./layout"
export { generateCity } from "./generateCity"
export { mountCity, type MountedCity, type MountCityOptions } from "./mountCity"
export { stubCity } from "./stubCity"
export { createStreamManager, type StreamManager, type StreamOptions } from "./stream"
export { createStreamingCollision, chunkObstacles, type StreamingCollision } from "./collision"
export { buildChunkMesh, beginChunkMesh, type ChunkMesh, type ChunkBuilder } from "./chunkMesh"
export { chunkGroundRequest } from "./chunkGround"
export { createCityCache, type CityCache } from "./cityCache"
