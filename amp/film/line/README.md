# One-film production line

Make one JSON lesson film covering every problem type in an AMP skill. A director
supplies the brief, concept, primary template, author, effort, and references.
The line prepares facts, checks the screenplay, voices it, and exports it to the
private review service. The film kit is documented in [AUTHORING.md](../AUTHORING.md).

Use Python 3.11+, AMP's Node dependencies, FFmpeg with `drawtext`, Playwright's
Chromium, `trash`, and the machine's heavy-command wrapper. Authoring requires the
chosen authenticated CLI: Claude for fable/opus/sonnet, Codex for astra/sol, or Grok.
Claude uses an Anthropic API key. Narration requires ElevenLabs access.

Copy `config.example.json` outside Git and fill its paths. `worktree` names the
checkout containing this line and the current kit. `standards` names a JSON array
of official standards with `code`, `aliases`, `text`, and `parts`. `env_file` is
read as data, never executed; only the Anthropic and ElevenLabs keys are read.
`root`, `live_data`, `voice_cache`, briefs, and concepts belong outside Git.
The review service must be running, with its player installed and reachable at
`player_url`. Install a review-page build supporting `list=line` for next-film navigation.

Run from the repository root. These examples use the real `slope` skill and its
`graphed-line-slope` primary template; replace the private example paths:

```sh
export FILM_LINE_CONFIG=/private/lesson-films/_line/config.json
python3 amp/film/line/line.py facts --skill slope --out /private/slope-facts
python3 amp/film/line/line.py write --film graphed-line-slope--pilot --skill slope --model sol --effort high --brief /private/brief.txt --concept /private/slope-concept.txt --reference line-slope
python3 amp/film/line/line.py predict --film graphed-line-slope--pilot --score 8 --reason "The rise and run are visible in each worked example."
python3 amp/film/line/line.py voice --film graphed-line-slope--pilot
python3 amp/film/line/line.py export --film graphed-line-slope--pilot
python3 amp/film/line/line.py board
```

Alternatively put `--config /private/line.json` before the subcommand. `--concept`
and `--reference` are optional; references accept several IDs or repeated flags.
Effort is `low`, `medium`, `high`, or `xhigh`. IDs use
`<primary-template-id>--<suffix>`; the primary template must belong to the skill.
The kit's example figure and metadata come from that primary template.

`facts.json` includes the full skill row, exact matched standards, unresolved
alignments, and ten deterministic problems with answers per type, its written
lessons, and figure components and named parts. Samples do not enumerate every case.
`write` copies mechanics and named references into an isolated private workspace,
allows 45 minutes for the author, then checks landscape and portrait storyboards
against the installed review player. It stops before narration.

Each film lives at `root/<film-id>/`. Its `recipe.json` records the exact prompt,
standards, model, effort, voice IDs, stage attempts, tokens, dollars, voice usage,
processing time, and status. Unknown costs stay unavailable; partial charges are
lower bounds. Workspaces depend on the recorded checkout and its installed dependencies;
source changes are rejected when resuming a film.

Repeat a command to reuse completed work. `write` rechecks an edited screenplay
without rerunning a completed author. Changed assignments or a failed/interrupted
author require a new film ID for another paid attempt. Keep the old evidence.
Voice caches, the 50,000-credit reserve, acoustic repair takes, and the request
ledger are preserved. The cast uses alternating Madeline/Paul teachers and Champ,
with exact voice IDs validated before rendering. `voice` and `export` reject stale checks.

Export writes `line.html`, newest first, with no author attribution. `board`
regenerates `board.html` beside it, reading current reviews and private predictions.
Model and effort appear only after a current numeric founder score. Legacy
approve/reject verdicts do not reveal them. Last-ten averages exclude unavailable
measurements and show their sample counts. Token totals count input, cache writes,
and output; reasoning is not added again. These pages and review data are private.

Offline checks (wrap each in the machine's heavy-command gate locally):
`python3 -m pytest amp/film/line`; from `amp/`, `npm run tsc` and `npm run film:test`.
Tests use fake providers and quota responses. CI runs them through `amp-film`.
