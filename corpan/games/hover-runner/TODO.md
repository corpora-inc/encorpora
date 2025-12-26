# Hover Runner TODO

## Mobile

- Bigger settings elements for mobile
- toggle between motion or touch (only show motion controls on mobile, try to turn on motion controls by default on mobile)

## Fit words better on screen

- the words _must_ always fit .. perhaps they need to be scaled down for longer phrases or allow them to go off the sides a bit..

## whole scene fit

move the grid down (avatar closer to the camera) - move road down a bit.

## Cooler scenery

without killing performance, let's make the scenes a little bit more trippy and cool looking.

## Settings cleanup

There should be a difference between what should be a constant, what should be automatically adjusted based on the gameplay, and what should be user-tunable.

- speed: user sets baseline. game adjusts based on performance - a little up and a little down with each correct/incorrect.
- respawn: I can't tell what this does exactly - it should almost surely just be a constant that just stays the same and be removed from the user settings?


- text scale setting: should be more like 0.01 to 1.0 instead of 0.5 to 3.0. I think 1 is plenty big enough.

## Build up slowly, automatically

The number of phrases and the speed should build up slowly over time, automatically, without user intervention. It should be noticable within some few minutes of gameplay. Making incorrect answers should reduce the speed a bit and make the game easier again. It should be a nice smooth curve up and down. If the person gets 90% correct it should quickly get more exciting but come back down to baseline if they start missing more often.

## Audio/Music polish

- when we turn the music off can we fade it to 0 over 1 second instead of cutting it off abruptly?


## Polish Corpan Logo Avatar

move electric ball up to the center of the ear with a cool effect that the ear is some sort of space gateway energy conductor. The electricity beams out of the ear. Basically, maybe the electricty just moves up from inside the pyramid to above it.

## Word Coin Feature

- On correct: explode words/characters as collectible gold rings with the word or character inside them
- Coins get scattered far down the road to get possibly collected later. They can float in any part of the grid for the user to collect them later.
- On wrong: scatter coins get busted out of the avatar (Sonic-style), the coin counts of the user are decreased - user has a count of each word/character collected
- Track coin count, we can make some sort of grand analytics review screen later on



<!-- ## Task 5: Dynamic Timing Based on Phrase Length
- Add helper: `getPhraseDuration(text, lang)` = baseMs + (units * msPerUnit)
- Use for intro phase timing (replace hardcoded `introHoldMs`)
- Use for celebrate phase timing (replace hardcoded `celebrationMs`) -->

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


