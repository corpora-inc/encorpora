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


## Word Coin Feature

- On correct: explode words/characters as collectible gold rings with the word or character inside them
- Coins get scattered far down the road to get possibly collected later. They can float in any part of the grid for the user to collect them later.
- On wrong: scatter coins get busted out of the avatar (Sonic-style), the coin counts of the user are decreased - user has a count of each word/character collected
- Track coin count, we can make some sort of grand analytics review screen later on



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



- Particle effects: use Babylon.js ParticleSystem


