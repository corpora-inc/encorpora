export type StackConfig = {
  activeStackId: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
  textSize: string
  showRomanization: boolean
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  stopSpeech?: () => Promise<void>
  dispose?: () => void
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<unknown>
  getRandomEntries?: (count: number) => Promise<unknown[]>
  getEntryById: (entryId: number) => Promise<unknown>
  isMock?: boolean
}

export type ContentPackManifest = {
  id: string
  name: string
  version: string
  entry: string
  styles?: string[]
  baseUrl?: string
  entryType?: "script" | "module"
  sdkVersion?: string
  permissions?: string[]
  devRevision?: string
}

export type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
}
