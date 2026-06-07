import { z } from "zod"
import { LanguageCode, PlayerId } from "./ids"

/**
 * AI-mediated chat: unreviewed text/audio never crosses between players. The
 * sender's device cleans and moderates it into a safe intent; the server
 * validates and routes that intent; the recipient's device independently
 * cleans it again, translates it into their learning language, and presents a
 * language-learning artifact.
 */

export const SafetyClass = z.enum(["ok", "softened", "blocked"])
export type SafetyClass = z.infer<typeof SafetyClass>

export const ModerationDecision = z.object({
  decision: z.enum(["allow", "transform", "block"]),
  reasons: z.array(z.string()), // 'pii' | 'link' | 'abuse' | 'nonsense' | 'lowconf'
  confidence: z.number().min(0).max(1),
})
export type ModerationDecision = z.infer<typeof ModerationDecision>

const ChatSource = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("speech"), transcript: z.string() }),
  z.object({ kind: z.literal("phraseCard"), entryId: z.number().int() }),
])

export const MediatedChatInput = z.object({
  from: PlayerId,
  to: PlayerId,
  interactionId: z.string().min(1),
  source: ChatSource,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  mode: z.enum(["beginner", "advanced"]),
})
export type MediatedChatInput = z.infer<typeof MediatedChatInput>

export const SuggestedReply = z.object({
  id: z.string().min(1),
  label: z.string(),
  entryId: z.number().int().optional(),
})
export type SuggestedReply = z.infer<typeof SuggestedReply>

export const LessonNote = z.object({
  kind: z.enum(["grammar", "vocab", "culture"]),
  text: z.string(),
})
export type LessonNote = z.infer<typeof LessonNote>

/** What the RECIPIENT receives — a lesson, already sanitized + translated. */
export const MediatedChatArtifact = z.object({
  artifactId: z.string().min(1),
  interactionId: z.string().min(1),
  sourcePlayerId: PlayerId,
  targetPlayerId: PlayerId,
  sourceLanguage: LanguageCode,
  targetLanguage: LanguageCode,
  visibleText: z.string(),
  learnerText: z.string().optional(),
  transliteration: z.string().optional(),
  literalGloss: z.string().optional(),
  naturalTranslation: z.string().optional(),
  suggestedReplies: z.array(SuggestedReply),
  lessonNotes: z.array(LessonNote),
  moderation: ModerationDecision,
  safetyClass: SafetyClass,
})
export type MediatedChatArtifact = z.infer<typeof MediatedChatArtifact>
