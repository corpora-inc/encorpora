import {
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3,
} from "@babylonjs/core"

export type ParticleManager = {
  blastAt: (x: number, y: number, color?: string) => void
  hitSparkAt: (x: number, y: number) => void
  deathSpiral: (x: number, y: number) => void
  trailAt: (x: number, y: number, color?: string) => void
  dispose: () => void
}

const hexToColor4 = (hex: string, alpha = 1): Color4 => {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new Color4(r, g, b, alpha)
}

// Tiny white pixel texture data URL
const PIXEL_TEX = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAABdJREFUGBljYPj//z8DMsYIFGBEFwADAACjBgMBhWfHHgAAAABJRU5ErkJggg=="

export const createParticleManager = (scene: Scene): ParticleManager => {
  const systems: ParticleSystem[] = []

  const autoClean = (ps: ParticleSystem, emitMs: number, lingerMs: number) => {
    ps.start()
    systems.push(ps)
    setTimeout(() => {
      ps.stop()
      setTimeout(() => {
        ps.dispose()
        const idx = systems.indexOf(ps)
        if (idx >= 0) systems.splice(idx, 1)
      }, lingerMs)
    }, emitMs)
  }

  const blastAt = (x: number, y: number, color = "#ff4444") => {
    const ps = new ParticleSystem("blast", 80, scene)
    ps.createPointEmitter(new Vector3(-1, -1, 0), new Vector3(1, 1, 0))
    ps.emitter = new Vector3(x, y, 0)
    ps.minLifeTime = 0.3
    ps.maxLifeTime = 0.8
    ps.minSize = 0.04
    ps.maxSize = 0.28
    ps.emitRate = 0
    ps.manualEmitCount = 70
    ps.minEmitPower = 3
    ps.maxEmitPower = 8
    ps.gravity = new Vector3(0, -3, 0)

    const c = hexToColor4(color)
    ps.color1 = new Color4(1, 1, 1, 1)
    ps.color2 = c
    ps.colorDead = new Color4(c.r * 0.3, c.g * 0.3, c.b * 0.3, 0)

    ps.particleTexture = new Texture(PIXEL_TEX, scene)

    autoClean(ps, 120, 1000)
  }

  const hitSparkAt = (x: number, y: number) => {
    const ps = new ParticleSystem("spark", 25, scene)
    ps.createPointEmitter(new Vector3(-0.5, -0.5, 0), new Vector3(0.5, 0.5, 0))
    ps.emitter = new Vector3(x, y, 0)
    ps.minLifeTime = 0.1
    ps.maxLifeTime = 0.35
    ps.minSize = 0.02
    ps.maxSize = 0.1
    ps.emitRate = 0
    ps.manualEmitCount = 20
    ps.minEmitPower = 4
    ps.maxEmitPower = 10
    ps.gravity = new Vector3(0, -2, 0)

    ps.color1 = new Color4(1, 1, 0.5, 1)
    ps.color2 = new Color4(1, 0.8, 0, 1)
    ps.colorDead = new Color4(1, 0.3, 0, 0)

    ps.particleTexture = new Texture(PIXEL_TEX, scene)

    autoClean(ps, 60, 500)
  }

  const deathSpiral = (x: number, y: number) => {
    const ps = new ParticleSystem("death", 120, scene)
    ps.createPointEmitter(new Vector3(-1.5, -1.5, 0), new Vector3(1.5, 1.5, 0))
    ps.emitter = new Vector3(x, y, 0)
    ps.minLifeTime = 0.5
    ps.maxLifeTime = 1.2
    ps.minSize = 0.06
    ps.maxSize = 0.3
    ps.emitRate = 0
    ps.manualEmitCount = 100
    ps.minEmitPower = 2
    ps.maxEmitPower = 7
    ps.gravity = new Vector3(0, -1, 0)

    // Spin effect via angular speed
    ps.minAngularSpeed = -4
    ps.maxAngularSpeed = 4

    ps.color1 = new Color4(0, 1, 1, 1)
    ps.color2 = new Color4(1, 0.3, 0.3, 1)
    ps.colorDead = new Color4(0.5, 0, 0.5, 0)

    ps.particleTexture = new Texture(PIXEL_TEX, scene)

    autoClean(ps, 150, 1500)
  }

  const trailAt = (x: number, y: number, color = "#00ccff") => {
    const ps = new ParticleSystem("trail", 10, scene)
    ps.createPointEmitter(new Vector3(-0.1, -0.1, 0), new Vector3(0.1, 0.1, 0))
    ps.emitter = new Vector3(x, y, 0)
    ps.minLifeTime = 0.1
    ps.maxLifeTime = 0.25
    ps.minSize = 0.02
    ps.maxSize = 0.06
    ps.emitRate = 0
    ps.manualEmitCount = 3
    ps.minEmitPower = 0.5
    ps.maxEmitPower = 1.5
    ps.gravity = new Vector3(0, 0, 0)

    const c = hexToColor4(color)
    ps.color1 = c
    ps.color2 = new Color4(c.r * 0.5, c.g * 0.5, c.b * 0.5, 0.5)
    ps.colorDead = new Color4(0, 0, 0, 0)

    ps.particleTexture = new Texture(PIXEL_TEX, scene)

    autoClean(ps, 30, 300)
  }

  const dispose = () => {
    for (const ps of systems) {
      ps.stop()
      ps.dispose()
    }
    systems.length = 0
  }

  return { blastAt, hitSparkAt, deathSpiral, trailAt, dispose }
}
