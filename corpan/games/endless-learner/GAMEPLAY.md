# Endless Learner - Target Gameplay

## Core loop

1) Pick a single phrase from the corpus (filtered by stack levels/domains).
2) Speak the phrase in one language from the stack (the “prompt language”).
3) Send one possible answer down one of nine invisible rails toward the player.
4) Player moves between rails, aligning their “beam” with the approaching answer.
5) Player taps “Zap” to select the current rail’s answer instantly.
6) If correct, reward and advance to a new phrase; if wrong, keep the phrase and try again.

## Visual language

- The 3x3 rail grid is *not* shown as a grid.
- Instead: nine colored, faintly glowing rails that bend gently across the scene.
- The player’s current rail emits a subtle electric beam that connects to the closest answer on that rail.
- Answers drift slowly toward the player along their rail; the beam pulses when aligned.

## Language modes (mix and match)

- Native → Learning (A)
- Learning → Native (C)
- Learning → Learning (same language, spelling check)
- Learning → Learning+ (cross-learning, only when multiple learning languages exist)

## Player movement

- There are 9 lanes (3x3). Each answer chooses one lane.
- The player occupies one lane at a time and moves smoothly between lanes.
- Controls: WASD / arrow keys. Tap/click to move on mobile.

## Answer cadence (relaxed default)

- One incoming answer at a time (very slow drift).
- Prompt repeats every ~7 seconds until correct.
- The phrase does **not** change until a correct answer is chosen.

## Feedback

- Correct: short reward cue, show translation, optionally speak the answer language.
- Wrong: short cue, encourage another attempt.
- Missed correct: label that it was correct and keep the same phrase.

## Difficulty ramp (future)

- Increase answer speed, reduce spacing, and introduce multiple answers.
- Introduce decoys from related domains/levels.
- Multi-phrase challenges (matching multiple prompts at once).

## Design goals

- Calm, focused cadence by default.
- Clear feedback without stopping the game.
- Layered progression that can scale to expert-level intensity.
