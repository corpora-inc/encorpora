# Hover Runner TODO


## Mobile

- toggle between motion or touch (only show motion controls on mobile, try to turn on motion controls by default on mobile)

## Fit words better on screen

sometimes the words go under the road and it looks weird (still usable though)



## Cooler scenery

without killing performance, let's make the scenes a little bit more trippy and cool looking.



## Audio/Music polish

- when we turn the music off can we fade it to 0 over 1 second instead of cutting it off abruptly?




## Word Coin Feature

- On correct: explode words/characters as collectible gold rings with the word or character inside them
- Coins get scattered far down the road to get possibly collected later. They can float in any part of the grid for the user to collect them later.
- On wrong: scatter coins get busted out of the avatar (Sonic-style), the coin counts of the user are decreased - user has a count of each word/character collected
- Track coin count, we can make some sort of grand analytics review screen later on



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


