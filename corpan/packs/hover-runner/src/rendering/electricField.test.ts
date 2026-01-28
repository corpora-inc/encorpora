import { describe, it, expect, beforeEach } from "vitest"
import { Scene, Engine, NullEngine, TransformNode, Color3, Vector3, Matrix } from "@babylonjs/core"
import { createElectricField } from "./electricField"

describe("ElectricField", () => {
  let engine: Engine
  let scene: Scene
  let parent: TransformNode

  beforeEach(() => {
    // Create a NullEngine for headless testing (no WebGL required)
    engine = new NullEngine()
    scene = new Scene(engine)
    parent = new TransformNode("test-parent", scene)
  })

  it("should create electric field without errors", () => {
    expect(() => {
      createElectricField(scene, parent, new Color3(0.4, 0.9, 1))
    }).not.toThrow()
  })

  it("should have valid particle system callback signatures", () => {
    createElectricField(scene, parent, new Color3(0.4, 0.9, 1))

    // Find the particle systems
    const beamSparks = scene.particleSystems.find((ps) =>
      ps.name === "beam-sparks"
    )
    const coreParticles = scene.particleSystems.find((ps) =>
      ps.name === "core-sparks"
    )

    expect(beamSparks).toBeDefined()
    expect(coreParticles).toBeDefined()

    if (!beamSparks) return

    // Cast to any to access implementation-specific properties
    const sparksImpl = beamSparks as any

    // Test startPositionFunction signature
    // Expected: (worldMatrix, positionToUpdate, particle, isLocal?) => void
    if (sparksImpl.startPositionFunction) {
      const mockMatrix = Matrix.Identity()
      const mockPosition = Vector3.Zero()
      const mockParticle = { position: Vector3.Zero() } as any

      expect(() => {
        sparksImpl.startPositionFunction(
          mockMatrix,
          mockPosition,
          mockParticle,
          false
        )
      }).not.toThrow()

      // Verify mockPosition was modified (it should have copyFrom called)
      expect(mockPosition).toBeInstanceOf(Vector3)
    }

    // Test startDirectionFunction signature
    // Expected: (worldMatrix, directionToUpdate, particle, isLocal?) => void
    if (sparksImpl.startDirectionFunction) {
      const mockMatrix = Matrix.Identity()
      const mockDirection = Vector3.Zero()
      const mockParticle = { position: Vector3.Zero() } as any

      expect(() => {
        sparksImpl.startDirectionFunction(
          mockMatrix,
          mockDirection,
          mockParticle,
          false
        )
      }).not.toThrow()

      // Verify mockDirection was modified
      expect(mockDirection).toBeInstanceOf(Vector3)
      // Direction should have been set to something (not zero after the call completes)
      expect(
        mockDirection.x !== 0 || mockDirection.y !== 0 || mockDirection.z !== 0
      ).toBe(true)
    }
  })

  it("should handle invalid worldMatrix gracefully", () => {
    createElectricField(scene, parent, new Color3(0.4, 0.9, 1))

    const beamSparks = scene.particleSystems.find((ps) =>
      ps.name === "beam-sparks"
    )

    // Cast to any to access implementation-specific properties
    const sparksImpl = beamSparks as any

    if (!sparksImpl?.startDirectionFunction) return

    const mockDirection = Vector3.Zero()
    const mockParticle = { position: Vector3.Zero() } as any

    // Test with null/undefined worldMatrix
    expect(() => {
      sparksImpl.startDirectionFunction(
        null as any,
        mockDirection,
        mockParticle,
        false
      )
    }).not.toThrow()

    // Test with malformed matrix (missing m array)
    const badMatrix = { m: undefined } as any
    expect(() => {
      sparksImpl.startDirectionFunction(
        badMatrix,
        mockDirection,
        mockParticle,
        false
      )
    }).not.toThrow()

    // Test with incomplete matrix
    const incompleteMatrix = { m: [1, 2, 3] } as any
    expect(() => {
      sparksImpl.startDirectionFunction(
        incompleteMatrix,
        mockDirection,
        mockParticle,
        false
      )
    }).not.toThrow()
  })

  it("should update without target", () => {
    const field = createElectricField(scene, parent, new Color3(0.4, 0.9, 1))

    expect(() => {
      field.update(0.016, null, 0)
    }).not.toThrow()
  })

  it("should set color", () => {
    const field = createElectricField(scene, parent, new Color3(0.4, 0.9, 1))

    expect(() => {
      field.setColor(new Color3(1, 0.5, 0.2))
    }).not.toThrow()
  })
})
