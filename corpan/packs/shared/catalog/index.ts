// Catalog Browser — shared library for stargate-reader and earthgate-reader
// Themed via CSS custom properties (--catalog-*)

export type {
  CatalogV2,
  CatalogNarrationEntry,
  CatalogGamePack,
  PurchaseInfo,
  NarrationArtifact,
  InstalledNarration,
  DownloadState,
  BookGroup,
  SeriesGroup,
  // ── Narrator-first model ──
  Character,
  VoiceProfile,
  VoiceProvider,
  VoiceSource,
  BookEntry,
  CharacterGroup,
  NarrationKey,
} from "./src/types"

export { narrationKey, narrationKeyEquals } from "./src/types"

export { fetchCatalog, clearCatalogCache } from "./src/catalogFetch"

export { buildCatalogIndex, type CatalogIndex } from "./src/catalogIndex"

export {
  playPreview,
  stopPreview,
  isPreviewing,
  subscribePreview,
  getPreviewState,
  type VoicePreviewState,
  type VoicePreviewListener,
} from "./src/voicePreview"

export {
  createNarratorDetail,
  type NarratorDetail,
  type NarratorDetailOptions,
} from "./src/narratorDetail"

export {
  addInstalled,
  removeInstalled,
  isInstalled,
  getInstalled,
  listInstalled,
  listInstalledForBook,
  totalInstalledSizeMb,
  setNarrationFullness,
  isPreviewInstalled,
  listPreviewNarrationIds,
} from "./src/libraryStore"

export {
  upgradeNarration,
  upgradeActiveNarration,
  runUpgradeSweep,
  maybeUpgradeOnOpen,
  isLikelyUnmetered,
  canRunSweep,
  setUpgradeCatalogProvider,
  NARRATION_UPGRADED_EVENT,
  ENTITLEMENTS_CHANGED_EVENT,
} from "./src/upgradeManager"

export {
  groupByBook,
  groupBySeries,
  sortBooksWithinSeries,
  sortBooks,
  type BookSort,
  chooseNextBook,
  groupByCharacter,
  filterByLanguage,
  filterByCharacter,
  searchByTitle,
  searchCharacters,
  getAvailableLanguages,
  getLanguageName,
} from "./src/searchFilter"

export {
  installNarration,
  deleteNarration,
  isTauriAvailable,
  getPackUrl,
  isTwoZipEntry,
} from "./src/installManager"

export {
  isCurrentlySubscribed,
  isIapAvailable,
  fetchStoreProducts,
  purchaseSubscriptionProduct,
  resolveSubscriptionReceipt,
  requestRestorePurchases,
  getReaderPlatform,
  SUBSCRIPTION_MONTHLY_ID,
  SUBSCRIPTION_ANNUAL_ID,
  type StoreProduct,
  type EntitlementCheck,
  type PurchaseOutcome,
  type SubscriptionPlan,
} from "./src/purchaseManager"

export {
  startListening,
  stopListening,
  subscribe as subscribeProgress,
  getState as getProgressState,
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
