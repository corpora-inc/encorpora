# Corpan City — North Star (the overnight rethink)

## What makes a game GREAT (first principles)
A great game is a **cohesive dream**: every facet — light, sound, motion, story,
mechanic, learning — pulls toward ONE fantasy, and none breaks the spell. It
respects the player's time (no busywork), it has FLOW (each beat sets up the
next), it is BEAUTIFUL enough that you want to *be* there, and its core verb is
intrinsically satisfying.

## Our fantasy (the one sentence)
**"I am a traveler who learns a language by actually living in a beautiful
foreign city — ordering the coffee, haggling the price, asking the way — with
people who hear me and answer."**

The learning is not a quiz bolted onto a quest. The learning IS the gameplay:
you progress by *using* the language, and the world responds.

## Our unfair strengths — lean ALL the way in
1. **A 10,000-phrase, 51-language corpus + romanization.** Every scene can be
   authored from REAL phrases, localized for free. No other language game world
   has this depth on tap.
2. **On-device TTS in the target language.** The barista can actually SPEAK
   Spanish to you. The illusion becomes real when the city talks.
3. **Babylon 9 + Havok + Recast.** A modern engine that can do cinematic
   lighting, post-processing, real physics, and navmesh crowds — IN our stack.
4. **On-device LLM (Qwen3).** NPCs that converse, in character, offline.

If a facet doesn't lean on one of these, question it.

## The brutal problem list (2026-06-05, from the owner's screenshot)
VISUAL / "it looks like a 2010 prototype":
- Flat, unlit world. No shadows from buildings, no ambient occlusion, no bloom,
  no tone-mapping/color-grade. Everything reads as flat diffuse boxes.
- Vast EMPTY repetitive cobble; no mid-ground interest, no density, no life.
- Buildings are generic window-grid boxes; no silhouette variety, no landmarks
  that say "this is a PLACE."
- 3D characters have seams (a floating white collar where the face-card meets the
  body), stiff proportions, weak animation. Charming-adjacent, not charming.
- No time-of-day mood, no weather, no atmosphere beyond flat fog.
EXPERIENCE / "the spell never forms":
- SILENT. No ambient soundscape, no music, no footsteps, no SFX. Silence kills
  immersion instantly.
- The NPC doesn't SPEAK the language (TTS not woven into the encounter) — the
  single biggest missed strength.
- Quest vocab is random, not the scene's vocab — "order a coffee" then drill
  "el queso." The fiction and the learning are disconnected.
- No narrative through-line; quests are isolated chores, not a story you care
  about. No reason to keep going.
- The minigame is a generic translate drill, not "you are ordering, choose your
  line, the barista reacts."

## The plan — premium tracks (each must be verified from UNFRIENDLY angles)
- **A. CINEMATIC RENDERING** (biggest lever): Babylon DefaultRenderingPipeline —
  contact-hardening shadows, SSAO, bloom, ACES tone-mapping + color grade, FXAA;
  IBL/environment light; a real sun + time-of-day key. Flat → cinematic.
- **B. CHARACTER CRAFT**: kill the seam, premium proportions + charm, expressive
  idle/walk, look-at, blink, gesture. Characters you like.
- **C. LIVING WORLD**: density + detail + landmark silhouettes + material
  richness + ambient life + time-of-day. A place, not a void.
- **D. SOUND & VOICE**: ambient city soundscape + light adaptive music + footstep
  & UI SFX (WebAudio, no heavy assets) AND the NPC SPEAKS the target language via
  host TTS, woven into the encounter.
- **E. LEARNING↔STORY COHESION**: scene-authored phrasebooks from the corpus; the
  encounter is the conversation (choose your line, the NPC answers); a narrative
  spine that strings scenes into a journey worth finishing.
- **F. PHYSICS** (foundation): Havok capsule controller — real movement, ramps,
  no clip. Retires the slope/collision bug class.

## Non-negotiables for the night
- The trunk ALWAYS builds + tests green. Verify EVERYTHING with my own real-app
  screenshots from unfriendly angles. No self-reported "done." Iterate before
  shipping. Ship nothing to the user until it is genuinely great.
