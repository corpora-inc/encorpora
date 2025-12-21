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
  getStackConfig: () => StackConfig
  onStackConfigChange: (listener: (config: StackConfig) => void) => () => void
  getRandomEntry: () => Promise<unknown>
  getEntryById: (entryId: number) => Promise<unknown>
  isMock?: boolean
}

export type GameModule = {
  id: string
  mount: (
    container: HTMLElement,
    hostApi: HostApi,
    initialState?: Record<string, unknown>
  ) => { unmount?: () => void } | void
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
}

export function registerGame(game: GameModule): GameModule

export function createMockHostApi(options?:
  Partial<HostApi> & {
    stackConfig?: Partial<StackConfig>
  }
): HostApi

export function mountStandalone(
  game: GameModule,
  options?: {
    container?: HTMLElement
    hostApi?: HostApi
    initialState?: Record<string, unknown>
  }
): { unmount?: () => void }
