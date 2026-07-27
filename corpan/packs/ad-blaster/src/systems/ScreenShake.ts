import type { Scene } from "@babylonjs/core"

export type ScreenShake = {
  shake: (intensity: number) => void
  update: (dt: number) => void
  dispose: () => void
}

export const createScreenShake = (scene: Scene): ScreenShake => {
  let shakeAmount = 0
  const decay = 8 // exponential decay rate

  const shake = (intensity: number) => {
    shakeAmount = Math.max(shakeAmount, intensity)
  }

  const update = (dt: number) => {
    const camera = scene.activeCamera
    if (!camera) return

    if (shakeAmount > 0.001) {
      const offsetX = (Math.random() - 0.5) * 2 * shakeAmount
      const offsetY = (Math.random() - 0.5) * 2 * shakeAmount
      camera.position.x = offsetX
      camera.position.y = offsetY
      shakeAmount *= Math.max(0, 1 - decay * dt)
    } else {
      shakeAmount = 0
      camera.position.x = 0
      camera.position.y = 0
    }
  }

  const dispose = () => {
    shakeAmount = 0
  }

  return { shake, update, dispose }
}
