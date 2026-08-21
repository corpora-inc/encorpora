// Minimal host contract. Kronopán is language-agnostic: it teaches rhythm, so it
// barely touches the host. It reads the stack config only to pick a sensible UI
// language later, and otherwise runs entirely on its own audio and geometry.

export type StackConfig = {
  activeStackId?: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
}

export type HostApi = {
  speak?: (lang: string, text: string) => void | Promise<void>
  stopSpeech?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange?: (listener: (next: StackConfig) => void) => () => void
  isMock?: boolean
}

export type GameModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: { stackConfig?: StackConfig },
  ) => { unmount?: () => void } | void
}
