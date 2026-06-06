/**
 * The Phone — an extensible in-world app-shell (inventory + city-radio control,
 * with clean seams for future Mail/Calls/Quest apps), opened from the "all-hearing
 * ear" FAB. Public surface the orchestrator (`game.ts`) wires in.
 */
export { createPhoneSheet, type PhoneSheet, type PhoneSheetOptions } from "./phoneSheet"
export { createPhoneFab, type PhoneFabHandle, type PhoneFabOptions } from "./phoneFab"
export { createInventoryApp } from "./inventoryApp"
export { createMusicApp } from "./musicApp"
export type { PhoneApp, PhoneAppContext, PhoneAppInstance, PhoneT } from "./phoneApp"
