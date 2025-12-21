export type StackConfig = {
  activeStackId: string
  languages: string[]
  domains: string[]
  levels: string[]
  rate: number
}

export type HostApi = {
  speak: (uiCode: string, text: string) => Promise<void>
  getStackConfig: () => StackConfig
  getRandomEntry: () => Promise<unknown>
  getEntryById: (entryId: number) => Promise<unknown>
}

export type ContentPackManifest = {
  id: string
  name: string
  version: string
  entry: string
  styles?: string[]
}

export type ContentPackModule = {
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
}
