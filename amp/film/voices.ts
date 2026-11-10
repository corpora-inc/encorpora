/**
 * Who may speak, and the voices that can say their lines.
 *
 * Role kinds are this list: append a name to grow them. A voice is one entry
 * below: id, display name, the kinds it may play, and a delivery tag when it
 * has one. Nothing else in the kit names a voice.
 */
export const ROLE_KINDS = ["teacher", "learner", "narrator"] as const;
export type RoleKind = (typeof ROLE_KINDS)[number];

export type VoiceSpec = {
  /** ElevenLabs voice id. */
  id: string;
  /** Display name. It is not drawn on the picture. */
  name: string;
  /** `--voice speaker=short` */
  short: string;
  kinds: readonly RoleKind[];
  /** Sent ahead of the words when this voice uses a delivery tag. */
  tag?: string;
};

/** Solo films keep Madeline, including takes already paid for. */
export const NARRATOR_ID = "XescS24CsOySAkKrLAO3";

export const VOICES: readonly VoiceSpec[] = [
  { id: NARRATOR_ID, name: "Madeline Brousseaux", short: "madeline", kinds: ["teacher", "narrator"] },
  { id: "J3Ei0Lj6fAobhIqY5ySH", name: "Paul", short: "paul", kinds: ["teacher", "narrator"] },
  { id: "SYXbTJsLE7zmSjr1DchT", name: "Champ", short: "champ", kinds: ["learner"], tag: "[energetic]" },
  // A second learner, so two learners in one film are not given the same voice.
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", short: "sarah", kinds: ["learner"] },
];

export const isRoleKind = (value: string): value is RoleKind =>
  (ROLE_KINDS as readonly string[]).includes(value);

/** Registry order. The first voice of a kind is that kind's default, except teachers, who are hashed. */
export const voicesFor = (kind: RoleKind) => VOICES.filter((voice) => voice.kinds.includes(kind));
