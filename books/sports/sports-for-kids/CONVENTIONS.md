# Sports for Kids — Series Conventions

These conventions exist because **the real Ryan, Isabelle, and Avery will consume these books.** Anything in the manuscript that contradicts their actual life will break trust before they finish chapter one.

## Hard bans — never put these in any manuscript

- **Proper names for any other person** — no teammates, no coaches, no friends, no rivals. Use `my coach`, `my team`, `a kid on my team`, `a friend`.
- **Team names, gym names, club names** — no `Hawks`, `Comets`, `Maple Grove Gymnastics`. The narrator is on "a team," at "the gym," etc.
- **Uniform colors, jersey colors, bow colors** — no `blue and silver`, `silver with blue glitter`. Use `matching uniforms`.
- **Specific past-performance claims** — no `we got second place last year`, `I dropped a fly ball last week`, `I hit one home run`.
- **Skill-ranking claims** — no `I am not the best player on my team`, `I'm not the best tumbler`. Use universal framing: `some days I play great, some days I don't`.
- **Defensive lines** — no `A real one` or anything else that assumes audience skepticism. Real kids don't carry that energy uninvited.

## What is allowed

- The narrator's first name (Ryan, Isabelle, Avery) and approximate age
- How long they've been doing the sport ("since I was six")
- A position or role on the team ("I play second base", "I'm a base")
- A favorite event or skill ("Floor is my favorite")
- Generic personal traits ("pretty strong", "loves the game")
- Personal preferences about the experience ("I love halftime")
- "My coach", "my team", "my teammates", "a friend on my team"

A small fiction in *preference* (e.g. saying floor is favorite when the real kid prefers vault) is recoverable. A fiction in the *world around the kid* (Coach Maya, the Hawks, blue jerseys) is not.

## Tone — "kid-talk", not "narrator"

These books are a kid telling another kid about their sport. They are casual, fast, enthusiastic. They are not solemn audiobook narration.

This is reflected in the segment-spacing defaults (below). Future books in this series **must inherit these** — and other series with a "kid talking to kid" voice should consider them.

### Default segment-spacing for this series (`scripts/generate_segments.py`)

| Position                | This series | Default-tempo |
|-------------------------|------------:|--------------:|
| First TTS segment       |     **700ms** |        2000ms |
| Mid-paragraph           |     **400ms** |         500ms |
| Last sentence in para   |     **600ms** |         800ms |
| Image caption           |     **900ms** |        1200ms |
| List item (non-last)    |     **350ms** |         500ms |
| List item (last)        |     **550ms** |         800ms |

The original 2000ms first-segment pause made `Hey, I'm Ryan` sound like an announcer pause before a grave proclamation. 700ms restores the kid-energy: the listener barely has time to settle before the kid is already talking.

### Per-segment overrides

After `generate_segments.py` produces `segments.json`, hand-tune `tts.pause_after_ms` on any segment where the rhythm needs it. Examples:

- Last segment of a chapter, before the next chapter intro: bump to 800-1000ms for a breath.
- An emphasis line ("That's the secret, I think."): allow a longer pause after.
- Two short consecutive lines that should run-on: drop the first one's pause to 200-300ms.

Don't overdo it. The defaults are tuned. Override only when the read tells you to.

## "Why I Love It" / "What It Feels Like" chapters

These chapters are allowed and useful — they're the kid's voice anchoring the sport in something real. But they must follow the bans above. No fictional teammates inside a feeling-paragraph. No invented colors as part of a sensory description. Universal-kid-experience only.

When possible, anchor a feeling to a specific physical action ("when the pitcher winds up, see how the laces spin" rather than "it feels exciting") — turns vibes into teaching.

## Voice IDs (do not change between releases)

- `ryan`  — baseball narrator
- `isabelle`  — gymnastics narrator
- `avery`  — cheerleading narrator

Per the immutable voice-ID rule, never republish a book with a different voiceId. If the clone needs tuning, regenerate at the same voiceId.
