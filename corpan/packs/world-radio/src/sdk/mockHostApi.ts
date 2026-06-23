import type { HostApi, StackConfig } from "./types"

const defaultStack: StackConfig = {
  activeStackId: "mock",
  languages: ["fa", "sw", "zh-Hans"],
  domains: ["travel"],
  levels: ["A1"],
  rate: 0.8,
  textSize: "medium",
  showRomanization: true,
}

export function createMockHostApi(overrides: Partial<HostApi> & { stackConfig?: Partial<StackConfig> } = {}): HostApi {
  const { stackConfig: stackOverrides, ...rest } = overrides
  const stack = { ...defaultStack, ...(stackOverrides || {}) }

  return {
    isMock: true,
    speak: () => {},
    getStackConfig: () => ({ ...stack, languages: [...stack.languages] }),
    onStackConfigChange: (listener) => {
      listener({ ...stack, languages: [...stack.languages] })
      return () => {}
    },
    ...rest,
  }
}
