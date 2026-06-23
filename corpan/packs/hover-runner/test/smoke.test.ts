/**
 * Smoke tests to ensure basic scene loading works without crashes
 */

import { describe, it, expect, beforeAll } from 'vitest'
import { NullEngine, Scene, FreeCamera, Vector3 } from '@babylonjs/core'

describe('Scene Loading Smoke Tests', () => {
  let engine: NullEngine
  let scene: Scene

  beforeAll(() => {
    // Use NullEngine for headless testing (no WebGL required)
    engine = new NullEngine({
      renderWidth: 800,
      renderHeight: 600,
    })

    // Create basic scene with camera (required for rendering)
    scene = new Scene(engine)
    new FreeCamera('camera', new Vector3(0, 0, -10), scene)
  })

  it('should create engine without errors', () => {
    expect(engine).toBeDefined()
    expect(engine.isDisposed).toBe(false)
  })

  it('should create scene without errors', () => {
    expect(scene).toBeDefined()
    expect(scene.isDisposed).toBe(false)
  })

  it('should render a frame without errors', () => {
    expect(() => {
      scene.render()
    }).not.toThrow()
  })

  it('should handle multiple render frames', () => {
    expect(() => {
      for (let i = 0; i < 10; i++) {
        scene.render()
      }
    }).not.toThrow()
  })
})

describe('Game Store Smoke Tests', () => {
  it('should import game store creator without errors', async () => {
    // Dynamic import to test module loading
    const { createGameStore } = await import('../src/core/gameStore')
    expect(createGameStore).toBeDefined()
    expect(typeof createGameStore).toBe('function')
  })

  it('should create a game store instance', async () => {
    const { createGameStore } = await import('../src/core/gameStore')
    const store = createGameStore({ activePhrases: [] })

    expect(store).toBeDefined()
    const state = store.getState()
    expect(state).toBeDefined()
  })
})

// Note: Hoverboard module tests skipped because they require .glb asset loading
// which is not supported in the test environment. The module is tested via
// integration tests and manual testing in the browser.

describe('Utils Module Smoke Tests', () => {
  it('should import utils without errors', async () => {
    const utils = await import('../src/core/utils')
    expect(utils.getProgressionParams).toBeDefined()
  })

  it('should calculate progression params without errors', async () => {
    const { getProgressionParams } = await import('../src/core/utils')

    expect(() => {
      const params = getProgressionParams(1, 0, 12345)
      expect(params).toBeDefined()
      expect(params.sacredGeometries).toBeDefined()
      expect(Array.isArray(params.sacredGeometries)).toBe(true)
    }).not.toThrow()
  })

  it('should handle various progression levels', async () => {
    const { getProgressionParams } = await import('../src/core/utils')

    // Test progression at different netCorrect values
    const testCases = [0, 5, 10, 20, 50, 100]

    testCases.forEach(netCorrect => {
      expect(() => {
        const params = getProgressionParams(1, netCorrect, 12345)
        expect(params.sacredGeometries.length).toBeGreaterThanOrEqual(0)
        expect(params.sacredGeometries.length).toBeLessThanOrEqual(6)
      }).not.toThrow()
    })
  })
})
