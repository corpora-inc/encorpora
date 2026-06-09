/**
 * Teletron chrome localization.
 *
 * The UI text is localized into the user's NATIVE language — `stackConfig.languages[0]`
 * (the host passes the stack at mount; languages[0] is native, [1..] are learning).
 * `t(key, lang)` resolves the locale (collapsing variants: ko-polite→ko, pt-BR→pt,
 * zh-Hans→zh) and falls back to English per-key, so a missing/partial locale never
 * shows a blank — it shows clean English.
 *
 * The English block below is the source of truth. Other languages are generated
 * from it by `tools/gen_i18n.py` (which calls the repo's OpenAI translate tooling).
 * Generated locales are appended to LOCALES; English ships even if none exist yet.
 *
 * Voice: warm, plain "safe penpals." We keep ONE low-key, honest on-device
 * disclosure (in the privacy sheet) and otherwise don't over-explain the AI.
 */

export type I18nKey =
  // --- header / brand / connection status ---
  | "exitToCorpan"
  | "brandTagline"          // header subtitle under "Teletron"
  | "statusOffline"
  | "statusConnecting"
  | "statusOnline"
  | "statusReconnecting"
  // --- waiting room (lobby) ---
  | "backToConversations"
  | "lobbyKicker"           // "Private & kind by design"
  | "lobbyHeading"
  | "lobbySub"
  | "revealStackTitle"
  | "revealStackHint"
  | "revealCountryTitle"
  | "revealCountryHint"
  | "waitingRoom"
  | "waitingForSignal"
  | "privateProfile"
  // --- person card action labels ---
  | "actionInvite"
  | "actionOpen"
  | "actionEnded"
  | "actionInvited"
  | "actionWait"
  // --- inbox ---
  | "conversations"
  | "findAPenpal"
  | "noConversationsYet"
  | "convoEnded"            // inbox row status: kept here
  | "convoDrifted"          // inbox row status
  | "convoOnline"
  | "convoAway"
  | "unreadAria"            // "{name}, {status}, {count} unread"
  | "rowAria"               // "{name}, {status}"
  // --- thread head ---
  | "penpalConnected"       // was "AI-mediated connection"
  | "reconnectingEllipsis"
  | "partnerOfflineHead"    // "{name} is offline — they'll get your messages"
  | "threadDriftedHead"     // saved-here closure line in head
  | "chatEnded"
  // --- thread overflow menu ---
  | "more"
  | "muteVoice"
  | "unmuteVoice"
  | "endConversation"
  | "blockOrReport"
  // --- composer ---
  | "writeAMessage"
  | "speak"
  | "send"
  | "composerDrifted"       // placeholder when dormant
  | "composerEnded"
  | "composerChooseSomeone"
  | "composerRelayLoading"
  | "composerReconnecting"
  | "composerDailyUsed"
  | "composerWillSee"       // "Write — {name}'ll see it when they return"
  // --- quota line ---
  | "quotaPlus"
  | "quotaFree"             // "{count} free messages left today"
  // --- system bubbles ---
  | "penpalIntro"           // "You're penpals with {name}. Write something kind."
  | "partnerDriftedSystem"  // "{name} drifted away. Your conversation is kept here."
  | "youEndedChat"
  | "partnerEndedChat"      // "{name} ended the chat."
  | "cleaningLocally"
  | "interpretingLocally"
  | "couldNotPrepare"
  | "notSentChatEnded"
  | "couldNotOpen"
  // --- onboarding ---
  | "onboardingKicker"      // "Private by default"
  | "onboardingHeading"     // "Enter the waiting room"
  | "yourGeneratedName"
  | "rollAgain"
  | "showMessagesIn"
  | "languageNote"
  | "languageNoteHidden"    // "Some stack languages are hidden… : {languages}."
  | "enterWaitingRoom"
  // --- invite sheet ---
  | "inviteBody"            // "{name} would like to be your penpal."
  | "inviteSentTitle"       // "{name} sent an invitation"
  | "notNow"
  | "acceptChat"
  // --- safety sheet ---
  | "blockTitle"            // "Block {name}?"
  | "safetyBody"
  | "cancel"
  | "block"
  | "reportAndBlock"
  // --- cap-choice sheet ---
  | "capTitle"
  | "capBody"
  | "capKeepCurrent"
  | "capSwap"
  | "capGetPlus"
  // --- privacy disclosure (the ONE honest on-device line) ---
  | "privacyDisclosure"
  // --- toasts ---
  | "plusActive"
  | "reportedAndBlocked"    // "Reported and blocked {name}."
  | "blockedName"           // "Blocked {name}."
  | "stillConnecting"
  | "prepareAiFirst"
  | "alreadyChatting"       // "You are already chatting with {name}."
  | "waitingForRespond"     // "Waiting for {name} to respond."
  | "conversationLimit"
  | "invitationSent"        // "Invitation sent to {name}."
  | "reconnectingTryAgain"
  | "chooseToTalkFirst"
  | "sentYouAMessage"       // "{name} sent you a message."
  | "leftBeforeResponding"  // "{name} left before responding."
  | "wentOffline"           // "{name} went offline — keep writing, they'll get your messages."
  | "invitedButBusy"        // "{name} invited you, but you are already busy."
  | "invitationOutcome"     // "Invitation {outcome}."
  // --- model setup ---
  | "preparingPrivateRelay"
  | "checkingForModel"
  | "noOnDeviceAi"
  | "modelRequired"         // "Qwen3 4B is required once… ({size} MB)."
  | "installModel"
  | "loadingModel"
  | "downloadingSharedModel" // "Downloading shared model · {percent}%"
  | "modelCouldNotLoad"
  | "retry"
  | "someonePlaceholder"    // generic fallback partner name

type Dict = Record<I18nKey, string>

// ---- English source of truth ----
const en: Dict = {
  exitToCorpan: "Exit to Corpan",
  brandTagline: "safe penpals",
  statusOffline: "Offline",
  statusConnecting: "Connecting",
  statusOnline: "Online",
  statusReconnecting: "Reconnecting",

  backToConversations: "Back to conversations",
  lobbyKicker: "Private & kind by design",
  lobbyHeading: "Choose what you want to share.",
  lobbySub: "Your friendly name is always shown. Your language stack and country are up to you.",
  revealStackTitle: "Reveal language stack",
  revealStackHint: "Show what you speak and study",
  revealCountryTitle: "Reveal country",
  revealCountryHint: "Show your country flag in the waiting room",
  waitingRoom: "Waiting room",
  waitingForSignal: "Waiting for someone to say hello…",
  privateProfile: "Private profile",

  actionInvite: "Say hello",
  actionOpen: "Open",
  actionEnded: "Ended",
  actionInvited: "Invited",
  actionWait: "Wait",

  conversations: "Conversations",
  findAPenpal: "Find a penpal",
  noConversationsYet: "No penpals yet.",
  convoEnded: "Ended — kept here",
  convoDrifted: "Saved here",
  convoOnline: "Here now",
  convoAway: "Away",
  unreadAria: "{name}, {status}, {count} unread",
  rowAria: "{name}, {status}",

  penpalConnected: "Penpal · connected",
  reconnectingEllipsis: "Reconnecting…",
  partnerOfflineHead: "{name} is away — they'll get your messages",
  threadDriftedHead: "Saved here — pick up the thread anytime.",
  chatEnded: "Chat ended",

  more: "More",
  muteVoice: "Mute voice",
  unmuteVoice: "Unmute voice",
  endConversation: "End conversation",
  blockOrReport: "Block or report",

  writeAMessage: "Write something kind",
  speak: "Speak",
  send: "Send",
  composerDrifted: "Saved here — pick up the thread anytime.",
  composerEnded: "Chat ended",
  composerChooseSomeone: "Choose someone to write to",
  composerRelayLoading: "Getting things ready",
  composerReconnecting: "Reconnecting…",
  composerDailyUsed: "Daily messages used",
  composerWillSee: "Write — {name}'ll see it when they return",

  quotaPlus: "Corpan Plus · unlimited messages",
  quotaFree: "{count} free messages left today",

  penpalIntro: "You're penpals with {name}. Write something kind.",
  partnerDriftedSystem: "{name} drifted away. Your conversation is kept here.",
  youEndedChat: "You ended the chat.",
  partnerEndedChat: "{name} ended the chat.",
  cleaningLocally: "Tidying up your words…",
  interpretingLocally: "Reading their message…",
  couldNotPrepare: "That message couldn't be sent safely. Try again.",
  notSentChatEnded: "That message wasn't sent because the chat ended.",
  couldNotOpen: "That message couldn't be opened safely.",

  onboardingKicker: "Private by default",
  onboardingHeading: "Step into the waiting room",
  yourGeneratedName: "Your friendly name",
  rollAgain: "Roll again",
  showMessagesIn: "Show messages in",
  languageNote: "Choose from the ready languages in your learning stack. You can change this the next time you visit.",
  languageNoteHidden: "Some stack languages are resting in this first Teletron release while we polish them: {languages}.",
  enterWaitingRoom: "Enter waiting room",

  inviteBody: "{name} would like to be your penpal.",
  inviteSentTitle: "{name} said hello",
  notNow: "Not now",
  acceptChat: "Say hello back",

  blockTitle: "Block {name}?",
  safetyBody: "You won't see each other in Teletron again, and this conversation is removed from your device.",
  cancel: "Cancel",
  block: "Block",
  reportAndBlock: "Report & block",

  capTitle: "You already have a penpal",
  capBody: "The free tier keeps one penpal at a time. Get Corpán Plus to write with many penpals at once.",
  capKeepCurrent: "Keep current",
  capSwap: "End current & start new",
  capGetPlus: "Get Plus",

  privacyDisclosure: "Messages are translated and kept safe right on your device.",

  plusActive: "Corpan Plus active. Messages are unlimited.",
  reportedAndBlocked: "Reported and blocked {name}.",
  blockedName: "Blocked {name}.",
  stillConnecting: "Still connecting.",
  prepareAiFirst: "Just getting set up — one moment.",
  alreadyChatting: "You're already penpals with {name}.",
  waitingForRespond: "Waiting for {name} to respond.",
  conversationLimit: "You've reached the penpal limit.",
  invitationSent: "Said hello to {name}.",
  reconnectingTryAgain: "Reconnecting — try again in a moment.",
  chooseToTalkFirst: "Choose someone to write to first.",
  sentYouAMessage: "{name} sent you a message.",
  leftBeforeResponding: "{name} stepped away before responding.",
  wentOffline: "{name} stepped away — keep writing, they'll get your messages.",
  invitedButBusy: "{name} said hello, but you're already busy.",
  invitationOutcome: "Invitation {outcome}.",

  preparingPrivateRelay: "Getting Teletron ready",
  checkingForModel: "Checking this device…",
  noOnDeviceAi: "This version of Corpán can't keep messages safe on-device yet.",
  modelRequired: "A one-time setup is needed (shared with Tutomaton, {size} MB).",
  installModel: "Set up",
  loadingModel: "Waking up on this device…",
  downloadingSharedModel: "Setting up · {percent}%",
  modelCouldNotLoad: "Setup couldn't finish. Close other packs or retry.",
  retry: "Retry",
  someonePlaceholder: "your penpal",
}

// ---- Generated locales (filled by tools/gen_i18n.py). en is always present. ----
// GENERATED_LOCALES_START
const LOCALES: Record<string, Partial<Dict>> = {
  en,
}
// GENERATED_LOCALES_END

/** Collapse a stack language code to its base i18n locale key. */
function baseLocale(lang: string): string {
  if (!lang) return "en"
  if (lang === "ko-polite") return "ko"
  if (lang.startsWith("pa-")) return "pa"
  if (lang.startsWith("pt-")) return "pt"
  if (lang.startsWith("zh-")) return "zh"
  if (lang.startsWith("yue")) return "yue"
  return lang.split("-")[0] || "en"
}

/**
 * Translate a chrome key into the user's native UI language.
 * Resolution order: exact lang → collapsed base locale → English. Each step
 * falls back PER KEY, so a partial locale never renders a blank string.
 * `{token}` placeholders are replaced from `params` (simple string replace).
 */
export function t(key: I18nKey, lang: string, params?: Record<string, string>): string {
  const exact = LOCALES[lang]
  const base = LOCALES[baseLocale(lang)]
  const template = exact?.[key] ?? base?.[key] ?? en[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? params[name] : whole,
  )
}
