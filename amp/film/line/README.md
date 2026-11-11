# One-film production line

Make a skill-level lesson film from a director's brief, inspect it, revise it,
and release it to one private review queue. The [film kit](../AUTHORING.md)
defines screenplay actions. Generated films, briefs, notes, recipes, screenshots,
and reviews belong outside Git.

Use Python 3.11+, AMP's installed Node dependencies, FFmpeg with `drawtext`,
Playwright's configured Chromium, `trash`, and a heavy-command wrapper.
The local review service must serve its installed player, `review.html` supporting
`list=line`, the read-only `review` endpoint, and `data/`. Authoring requires the
chosen authenticated CLI; voicing requires ElevenLabs access.

Copy `config.example.json` outside Git. Set `worktree` to this checkout and
`queue_page` to the review site's root `index.html`. Keep that directory on the
same server as `live_data`; generated links follow their relative paths.
`standards` is a JSON array with `code`, `aliases`, `text`, and `parts`.
`env_file` is parsed as data, never executed. `claude_auth` is `api` (default,
Anthropic API key) or `subscription` (Claude CLI login, no API key in its
environment). Subscription attempts retain tokens; dollars are unavailable.

Run from the repository root. These examples use the real `slope` skill and its
`graphed-line-slope` template. Replace the illustrative private paths.

```sh
export FILM_LINE_CONFIG=/private/lesson-films/_line/config.json
python3 amp/film/line/line.py facts --film graphed-line-slope--pilot --skill slope
python3 amp/film/line/line.py write --film graphed-line-slope--pilot --skill slope --model sol --effort high --brief /private/brief.txt --concept /private/slope.txt --reference auto
python3 amp/film/line/line.py look --film graphed-line-slope--pilot
python3 amp/film/line/line.py revise --film graphed-line-slope--pilot --notes /private/director-notes.txt
python3 amp/film/line/line.py look --film graphed-line-slope--pilot
python3 amp/film/line/line.py predict --film graphed-line-slope--pilot --score 8 --reason "Both rise and run are visible."
python3 amp/film/line/line.py voice --film graphed-line-slope--pilot
python3 amp/film/line/line.py look --film graphed-line-slope--pilot
python3 amp/film/line/line.py export --film graphed-line-slope--pilot
python3 amp/film/line/line.py play --film graphed-line-slope--pilot
python3 amp/film/line/line.py release --film graphed-line-slope--pilot --level "Grade 8"
python3 amp/film/line/line.py board
```

`facts` includes every problem type, exact matched standards, unresolved
alignments, ten deterministic examples per type, written lessons and figure
parts. Use `facts --skill slope --out /private/slope-facts` for an unassigned pack.
Samples do not enumerate every possible case. Film IDs are
`<primary-template-id>--<suffix>`; the template must belong to the assigned skill.

`write` copies facts, mechanics and references into an isolated author workspace,
allows 45 minutes, and checks both player layouts. `--concept` is optional.
`--reference` accepts explicit IDs or `auto`: up to two released films with a
current founder score of at least 8, preferring the same grade band, newest first.
No qualifying films means no references. The recipe records the selected IDs.

`look` checks an edited screenplay if needed, then writes `<root>/<film>/look/`:
`script.txt`, numbered/timestamped wide and tall sheets of beat ends and held
highlights (`wide-lit-001.jpg`, `tall-lit-001.jpg`), and a filmstrip every two
seconds. Sheets contain up to twelve tiles.
Current `board/lit/NNN-word.jpg` and `board-tall/lit/NNN-word.jpg` frames are
reused by filename; missing frames are captured from the installed player using
the kit’s held-highlight times and filenames. `look.json` lists all sheets and
the timing source.
Current checked voiced timing takes precedence over estimated timing.

`check.json` and `look.json` carry notes, never failures, for unmatched problem
wording, an empty whiteboard during more than three seconds of speech, and an
opening question naming an explicit figure label before it appears. Problem
matching normalizes simple arithmetic and TeX wrappers; uncertain text is shown
side by side. Early-reference checks omit scene meanings, pronouns and inferred
references. Notes include shot, beat and time; estimated times are labeled.

`revise` uses the same author, effort, film ID and workspace screenplay. Its prompt
is the original assignment plus the director's notes. Each prior cut is archived;
the recipe records every attempt's prompt, tokens, dollars and seconds, plus
totals. One revision is typical; additional revisions are allowed. Repeating
`write` rechecks without launching a completed author again. Changed original
assignments require a new ID. After manual edits, run `look` to recheck.

`voice` preserves the quota reserve, voice bindings, cache and request ledger.
`export` copies the checked voiced payload and audio to the review service without
adding it to any list. `play` opens the real review page at 1280×800 and 390×844,
plays audio, seeks every highlight and sampled beat ends, and saves
`played-wide-*.jpg`, `played-phone-*.jpg` and `play.json` in `look/`. It reports
console errors, overflow and observed audio advancement; it cannot verify physical
speaker output. It blocks review writes and masks saved scores during capture.
`release` appends to `queue.json` in release order and generates the root queue
and `line.html`. The latter supplies Next-button data and redirects to the root.
The queue shows only films without a numeric founder score dated at or after
`released` (or `added` for older entries). Every release sets `released` to the
current ISO time, including re-release of a listed film; its list position stays
the same. Only released films appear on the scoreboard, which keeps score
history. `board` refreshes scores, adds its footer link to the queue and reveals an author only with a current numeric score.
To withdraw a film without deleting its files or reviews:

```sh
python3 amp/film/line/line.py unrelease --film graphed-line-slope--pilot
```

For a correction answering the founder’s notes, revise, inspect, voice and export
under the same ID without releasing again. Record the response with:

```sh
python3 amp/film/line/line.py follow-up --film graphed-line-slope--pilot --note "Clarified the rise and run labels."
```

`follow-up` runs `npm run film:publish -- --follow-up <id> --note <text>` from
`amp/` in the configured worktree and reports its output and exit status. The
publisher’s configuration selects the review directory; the command records
`followups.json` beside `grades.json`. It publishes nothing. The line exposes no
other publishing command. Export updates an existing publishing index entry
with the corrected edition. Export and follow-up preserve the queue’s release
record, so a correction does not request another score.

For a remake requiring a new score, release again when ready. Use `unrelease`
while preparing it if it should be hidden from the queue and scoreboard.
To register an external author's screenplay against this checkout's kit:

```sh
python3 amp/film/line/line.py adopt --film graphed-line-slope--outside --screenplay /private/screenplay.json --author "External author" --effort high --minutes 20 --tokens 4000
```

Adoption checks the ID and role-only cast and infers the skill from the template.
Minutes and tokens are optional external measurements. Edit adopted screenplays
in their workspace and run `look`; automated revision needs a line author.
Film locks allow independent authoring. Voice has one global lock; shared queue,
export and board writes use a short global lock. Source changes invalidate frozen
runtimes: adopt into a new film ID against the intended kit checkout.

Offline checks: through the machine's heavy-command wrapper, run
`python3 -m pytest amp/film/line -q`; from `amp/`, run `npm run tsc` and
`npm run film:test`. Tests use fake providers and local synthetic browser fixtures.
The existing `amp-film` CI job runs these tests; no extra status context is needed.
