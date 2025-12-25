# Hover Runner TODO

## Audio/Music polish

- when we turn the music off can we fade it to 0 over 1 second instead of cutting it off abruptly?


## Polish Corpan Logo Avatar
- The ear must be centered over the pyramid (centered over the base)
- the pyramid should have more depth in z and show more "stairs" in the front toward the user


## Data Persistence
- Persist score, streak, bestStreak, allTimeBestStreak in localStorage
- Add phrase history tracking: `[{id, sourceLang, targetLang, correct, timestamp}]`
- Restore stats on game load

## Scoring

- Show a juicy +N animation when the score increases

## Task 5: Dynamic Timing Based on Phrase Length
- Add helper: `getPhraseDuration(text, lang)` = baseMs + (units * msPerUnit)
- Use for intro phase timing (replace hardcoded `introHoldMs`)
- Use for celebrate phase timing (replace hardcoded `celebrationMs`)

## Task 6: Success Feedback - Particle Explosion
- Create Babylon.js ParticleSystem for success
- Gold/orange colors, burst outward, 100 particles
- Trigger at phrase position on correct answer
- Auto-dispose after 1 second

## Task 7: Fail Feedback - Screen Shake + Particles
- Add screen shake function (200ms duration, subtle intensity)
- Create fail particle system (dark red, downward motion)
- Trigger both on wrong answer

## Task 9: Create 2 New Avatar Variants
- "Crystal Wave" - purple hexagonal prism with floating crystal shards
- "Solar Flare" - orange-red surfboard with flame fins and central orb
- Add to variants array, accessible via avatar selector

## Task 10: Multi-Phrase Chaos Mode
- Add setting: `maxSimultaneousPhrases` (1-5, default 1)
- Add UI slider in tuning panel
- Modify game state to track multiple active phrases
- Stagger spawns (trickle out, not simultaneous)
- Update collision detection to handle multiple phrases

## Task 11: Word Coin Feature
- On correct: explode words/characters as collectible gold coins
- Coins travel toward player, collect on collision
- On wrong: scatter coins outward (Sonic-style), lose some coins
- Track coin count in stats, display in HUD

---

## Execution Order
1, 2, 3, 4, 5, 6, 7, 9, 10, 11

## Notes
- Task 8 skipped (visual polish requires human verification)
- Settings ranges: case-by-case (not all 0-100)
- Multi-phrase: trickle spawns, not simultaneous
- Particle effects: use Babylon.js ParticleSystem
- Music: Web Audio API for gapless looping
