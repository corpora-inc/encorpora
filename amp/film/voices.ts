/**
 * Who may speak, and the voices that can say their lines.
 *
 * Role kinds are this list: append a name to grow them. A voice is one entry
 * below: id, display name, the kinds it may play, and a delivery tag when it
 * has one. Nothing else in the kit names a voice.
 */
export const ROLE_KINDS = ["teacher", "learner", "narrator"] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

/** Who makes a voice's takes. ElevenLabs when absent; `spark` is our own Chatterbox service (spark-voice/). */
export type VoiceProvider = "elevenlabs" | "spark";

export type VoiceSpec = {
  /** ElevenLabs voice id, or `house-<short>` for a house voice. Timing records it. */
  id: string;
  /** Display name. It is not drawn on the picture. */
  name: string;
  /** `--voice speaker=short` */
  short: string;
  kinds: readonly RoleKind[];
  /** Sent ahead of the words when this voice uses a delivery tag. */
  tag?: string;
  /** Absent for ElevenLabs. */
  provider?: "spark";
  /** The service's model id, for a spark voice. */
  model?: string;
};

/** Solo films keep Madeline, including takes already paid for. */
export const NARRATOR_ID = "XescS24CsOySAkKrLAO3";

/** The Spark service's model for house voices: Chatterbox Multilingual V3. */
export const HOUSE_MODEL = "chatterbox-v3";

/**
 * Approved voices: Madeline, Paul and Champ on ElevenLabs, and the house
 * voices (Rowan, Wren, Pip), which are ours: designed from text, cloned by
 * Chatterbox on the Spark (spark-voice/README.md). A film is voiced by house
 * voices only when asked: `--voice teacher=rowan` or `--provider spark`.
 * A house voice's reference clip is locked: cached takes are keyed by its id,
 * so a new reference is a new voice with a new id.
 */
export const VOICES: readonly VoiceSpec[] = [
  { id: NARRATOR_ID, name: "Madeline Brousseaux", short: "madeline", kinds: ["teacher", "narrator"] },
  { id: "J3Ei0Lj6fAobhIqY5ySH", name: "Paul", short: "paul", kinds: ["teacher", "narrator"] },
  { id: "SYXbTJsLE7zmSjr1DchT", name: "Champ", short: "champ", kinds: ["learner"], tag: "[energetic]" },
  { id: "house-rowan", name: "Rowan", short: "rowan", kinds: ["teacher", "narrator"], provider: "spark", model: HOUSE_MODEL },
  { id: "house-wren", name: "Wren", short: "wren", kinds: ["teacher", "narrator"], provider: "spark", model: HOUSE_MODEL },
  { id: "house-pip", name: "Pip", short: "pip", kinds: ["learner"], provider: "spark", model: HOUSE_MODEL },
];

export const providerOf = (voice: Pick<VoiceSpec, "provider">): VoiceProvider => voice.provider ?? "elevenlabs";

export const isRoleKind = (value: string): value is RoleKind =>
  (ROLE_KINDS as readonly string[]).includes(value);

/** Registry order. The first voice of a kind is that kind's default, except teachers, who are hashed. */
export const voicesFor = (kind: RoleKind, registry: readonly VoiceSpec[] = VOICES, provider?: VoiceProvider) =>
  registry.filter((voice) => voice.kinds.includes(kind) && (!provider || providerOf(voice) === provider));
