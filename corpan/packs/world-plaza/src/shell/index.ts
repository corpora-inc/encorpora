/**
 * World Plaza — shell barrel. The game lifecycle frame (§4 PREMIUM_FOUNDATIONS):
 * pause, exit-to-host, in-pack confirm, and the save/restore seam.
 */
export { createShell, type Shell, type ShellOptions, type ShellStrings } from "./shell"
export { wpConfirm, type WpConfirmOpts } from "./confirm"
export {
  confirmAndExit,
  requestHostExit,
  isEmbeddedInHost,
  type ExitStrings,
  DEFAULT_EXIT_STRINGS,
} from "./exit"
export {
  createMenuPanel,
  type MenuPanelHandle,
  type MenuPanelOptions,
  type MenuStrings,
  type MenuSectionId,
  type MenuSectionView,
  DEFAULT_MENU_STRINGS,
} from "./menuPanel"
export { createMenuButton, type MenuButtonHandle, type MenuButtonOptions } from "./menuButton"
export {
  loadSave,
  writeSave,
  clearSave,
  SAVE_KEY,
  SAVE_VERSION,
  type WorldPlazaSave,
  type SaveSnapshotProvider,
  type SavedPosition,
  type SavedProgress,
} from "./save"
