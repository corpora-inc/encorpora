// Catalog Browser — shared library for stargate-reader and earthgate-reader
// Themed via CSS custom properties (--catalog-*)

export type {
  CatalogV2,
  CatalogNarrationEntry,
  CatalogGamePack,
  PurchaseInfo,
  InstalledNarration,
  DownloadState,
  BookGroup,
  SeriesGroup,
} from "./src/types"

export { fetchCatalog, clearCatalogCache } from "./src/catalogFetch"

export {
  addInstalled,
  removeInstalled,
  isInstalled,
  getInstalled,
  listInstalled,
  listInstalledForBook,
  totalInstalledSizeMb,
} from "./src/libraryStore"

export {
  groupByBook,
  groupBySeries,
  filterByLanguage,
  searchByTitle,
  getAvailableLanguages,
  getLanguageName,
} from "./src/searchFilter"

export {
  installNarration,
  deleteNarration,
  isTauriAvailable,
  getPackUrl,
} from "./src/installManager"

export {
  startListening,
  stopListening,
  subscribe as subscribeProgress,
  getState as getProgressState,
  setStarting as setProgressStarting,
} from "./src/downloadProgress"

export {
  createCatalogBrowser,
  createLibraryButton,
  type CatalogBrowser,
  type CatalogBrowserOptions,
} from "./src/catalogBrowser"

export {
  createBookDetail,
  type BookDetail,
  type BookDetailOptions,
} from "./src/bookDetail"

export {
  createAppShell,
  type AppShell,
  type AppShellOptions,
  type ReaderFactory,
} from "./src/appShell"

export { compareVersions, hasUpdate } from "./src/versionUtil"

// Re-export drawer types used by readers
export type { DrawerSectionDef, LanguageInfo } from "../ui/commandDrawer"
export type { DrawerScreen } from "../state/drawerStore"
