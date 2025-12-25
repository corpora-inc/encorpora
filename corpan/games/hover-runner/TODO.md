# Hover Runner TODO

## Music polish

- when we turn the music off can we fade it to 0 over 1 second instead of cutting it off abruptly?

## Task 2: Music and SFX Settings
- Add to tuningStore: `musicEnabled`, `sfxEnabled`, `musicVolume`, `sfxVolume`
- Add UI toggles in tuning panel (checkboxes + volume sliders)
- Wire toggles to audio.ts methods
- Check `sfxEnabled` before playing success/fail sounds

## Task 3: Data Persistence
- Persist score, streak, bestStreak, allTimeBestStreak in localStorage
- Add phrase history tracking: `[{id, sourceLang, targetLang, correct, timestamp}]`
- Cap history at 1000 entries (FIFO)
- Restore stats on game load

## Task 4: Scoring Based on Phrase Length
- Dodging wrong answer: +1 point (unchanged)
- Correct answer: +N points where N = word count (or character count for CJK)
- Add helper: `getPhraseScore(text, lang)` - detects CJK vs word-based languages

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

## Task 8: Polish Corpan Logo Avatar
**SKIP** - requires visual verification, not suitable for overnight run

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
