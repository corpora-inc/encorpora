/**
 * The Phone — an in-world phone simulator that is the SINGLE in-game menu. ONE FAB
 * (the Corpán brand mark) opens a HOME SCREEN of apps: Map, Things (Inventory),
 * Quest, Badges, Music. Each app re-homes an existing menu section (or drives the
 * city radio). Public surface the orchestrator (`game.ts`) wires in.
 */
export { createPhoneSheet, type PhoneSheet, type PhoneSheetOptions } from "./phoneSheet"
export { createPhoneFab, type PhoneFabHandle, type PhoneFabOptions } from "./phoneFab"
export { createSectionApp, APP_ICONS } from "./sectionApp"
export { createMusicApp, type MusicAppDeps } from "./musicApp"
export type { PhoneApp, PhoneAppContext, PhoneAppIcon, PhoneAppInstance, PhoneT } from "./phoneApp"
