let activeToken = 0

export type GameRuntime = {
  isActive: () => boolean
  stop: () => void
}

export const createRuntime = (): GameRuntime => {
  const token = ++activeToken
  return {
    isActive: () => token === activeToken,
    stop: () => {
      if (token === activeToken) {
        activeToken += 1
      }
    },
  }
}
