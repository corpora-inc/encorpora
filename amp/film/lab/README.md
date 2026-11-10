# Lesson-film model lab

This harness compares study, screenplay and review models for AMP lesson films. It selects 54 distinct problem types in six pathways, assigns nine study/writer combinations within each pathway, and exports voiced candidates under blind IDs. Five models review the candidates and 40 films with frozen founder grades. The report records results without choosing a winner before founder grading.

A pathway contains nine adjacent types in one family and grade, spanning at most three neighboring skills and 0.75 curriculum difficulty units. The six strata are K–2, grades 3–5, grades 6–8, high-school algebra/functions, high-school geometry/trigonometry, and high-school statistics/probability. Selection excludes approved films, figures outside the implemented kit, and example scenes needing a scale below the installed review player's minimum of 0.01. Comparisons across neighboring types contain type-level variation; they are not controlled comparisons of identical scripts or problems.

## Requirements

- A separate worktree containing the film kit and the AMP application dependencies.
- Python 3.11+, the Node version required by AMP, FFmpeg with `drawtext`, Chromium through Playwright, and the `trash` command.
- Authenticated `codex` and `grok` CLIs and a Claude Code version supporting `--bare`, `--restricted` and JSON output.
- An Anthropic API key and an ElevenLabs API key in a private environment file. The parser reads only `ANTHROPIC_API_KEY`, `ELEVEN_LABS_API_KEY` and `ELEVENLABS_API_KEY`; it does not execute the file.
- A private CCSS JSON array with `code`, `aliases`, `text` and `parts`, plus the running live review service and 40 version-matched founder grades.
- The machine's heavy-command wrapper. All type checks and browser/encoder commands must run through it.

Copy `config.example.json` outside the repository and replace its placeholder paths. Keep the output root outside every public checkout. Authoring workspaces must be inside this worktree's ignored `amp/film/lab/.work/` directory. The existing review server and its installed player stay in place.

## Prepare inputs

The following examples run from the worktree's `amp/` directory. Replace `/private/lab.json`, `/private/film-lab`, `/private/standards` and `/workspace/wt/add-film-model-lab` with the configured locations. Do not source credentials into the interactive shell.

```sh
python3 film/lab/prepare.py --config /private/lab.json --billing
/private/standards/heavy.sh node --import tsx film/lab/facts.ts inventory --standards /private/standards/ccss-math.json --out /private/film-lab/catalog.json
python3 film/lab/selection.py --root /private/film-lab --worktree /workspace/wt/add-film-model-lab --live-data /private/lesson-films/_review/live/data --seed 42
/private/standards/heavy.sh node --import tsx film/lab/facts.ts packs --standards /private/standards/ccss-math.json --out /private/film-lab/facts --types /private/film-lab/types.json --seed 42
```

`prepare.py` freezes the exact graded exports, checks the three approved voice IDs and quota, and optionally runs a one-line paid probe for each Anthropic model. Its billing evidence is API-key-only `--bare` authentication plus a positive CLI-reported cost. Repeating preparation reuses frozen labels and successful billing receipts. If API-key authentication fails, stop and correct the provider adapter before production; do not charge a subscription silently.

`facts.ts` builds ten deterministic problems per type, including answers, response formats, generated decoys, default and contextual written lessons, and prerequisites/successors with verbatim standards. Inferred misconceptions are distinguished from observed learner errors, which this input does not contain. Ten samples cannot establish complete catalog coverage.

`selection.json` records eligible pools, exclusions and the sampling rule. `arms.json` is the private assignment key. Selection refuses to replace an existing assignment. Read the selected family designs and inspect the recorded reasons before starting paid production.

## Run the experiment

```sh
python3 film/lab/lab.py --config /private/lab.json --phase calibration-prepare
python3 film/lab/lab.py --config /private/lab.json --phase smoke
```

Calibration preparation captures every beat of each exact graded export in wide and phone layouts using a frozen copy of the installed player. Each Anthropic reviewer first reviews one calibration film through the Messages API to validate the image request; those verdicts count toward calibration. The remaining items enter review batches. Preparation does not restart the service or expose grades to reviewers. The smoke phase produces all nine arms in the first pathway and obtains all five reviews. Inspect the dry checks, storyboard pages, live playback, accounting and blind IDs before proceeding:

```sh
python3 film/lab/lab.py --config /private/lab.json --phase rest
```

The remaining pathways run after the smoke phase. At most three local model agents run concurrently. Voice/export processing is serialized. Each pathway enters Anthropic image-review batches after its production and voice outcomes are settled, while later pathways can continue authoring. Astra and Grok calibration reviews fill free authoring slots once all authors have started; their reviews of new films follow production. Once the first API batches finish, completed failures enter their permitted second batch, overlapping new-film CLI reviews when ready. Pending remote batches do not hold up available CLI work. Batches can remain pending for up to the provider's completion window. The harness waits for submitted results before retrying failed items, avoiding duplicate charges from a speculative fallback.

Every role uses one shared prompt across models. Study and screenplay attempts have a combined limit of two failures per assigned type. A failed arm is recorded and is not replaced with an easier type. Writers can inspect files, write their screenplay, run the bounded kit-check command and repair their own errors. The check command runs `make.ts --dry --board` and figure checks in both layouts. A separate final check verifies the artifact and detects edits to the copied kit.

Teachers alternate the approved Madeline and Paul voice IDs; Champ uses the kit's learner voice. Voice IDs are validated before rendering and retained in timing metadata. The quota hook reserves credits for every narration take and transcription check, including retries. It refreshes live quota at least every 30 seconds and before requests near the reserve, deducts local spending between reads, and retries rate-limited quota reads with bounded backoff. Provider-confirmed charges release unused reservations; uncertain charges retain their full hold. Voicing stops when a request would breach the 50,000-credit reserve. The report separates input text characters from billed credits. A transient voice failure gets one whole-film retry, reusing cached takes, before the review payload is frozen. No MP4 is rendered. A private compatibility copy of each export supplies voice display names to the installed player; screenplay roles stay unbound.

The type-grouped `live/lab.html` page links blind exports into the existing grading player. It contains no assignment key. Existing grades, exports and JavaScript bundles are preserved. Export receipts verify the served JSON, audio length and index entry.

The isolated voice runtime permits the kit's existing third take after repeated acoustic faults, such as a truncated ending. Repeated transcript mismatches retain the kit's early stop. This correction changes neither the three-take ceiling nor the audio gate; its source and instrumented hashes are recorded in each runtime manifest. Record any mid-experiment harness corrections with their affected cohorts when interpreting completion rates.

## Recovery and results

Repeat the same phase with the same private configuration to resume. Completed artifacts and usage receipts are reused. A running process, changed prompt, changed assignment or changed review input blocks an unsafe resume. An ambiguous Batch API submission must be reconciled against the provider before resubmission. Do not delete receipts to force a retry.

```sh
python3 film/lab/lab.py --config /private/lab.json --phase reviews
python3 film/lab/lab.py --config /private/lab.json --phase report
```

`RESULTS.md` includes arm production/failure counts, measured cost and time, reviewer calibration with paired reasons, every new verdict, coverage gaps and documented kit/prompt findings. API-key usage costs are distinct from account-CLI costs; both use reported usage or client estimates rather than billing statements. Claude streams preserve deduplicated request inputs and completed output-usage events after interruption. Their partial costs are lower bounds; missing usage is unknown, not zero. Batch queue duration is not per-item execution time. Storyboards and timing do not assess audible voice quality.

Private evidence includes `runs/`, `films/`, `boards/`, `calibration-source/`, `calibration-labels.json`, `coverage-gaps.jsonl`, `voice-ledger.jsonl` and `voice-quota.json`. Never commit these, the assignment key, credentials, founder grades or unapproved screenplays. Preserve useful artifacts outside the worktree before cleaning ignored workspaces.

## Harness checks

These checks use synthetic fixtures and make no paid requests:

```sh
/private/standards/heavy.sh python3 -m unittest discover -s film/lab -p 'test_*.py'
/private/standards/heavy.sh node --test film/lab/quota-hook.test.mjs
/private/standards/heavy.sh python3 film/lab/check-pagination.py
```

Browser integration and the nine-arm smoke pathway are also required before a full experiment. Unit checks cannot establish compatibility with a changed kit or live player.

The existing path-gated `film:test` suite runs the Python and quota checks through `harness.test.ts`, plus the installed-player compatibility regression. These checks require no credentials, model CLIs or narration calls.
