# AMP lesson-film kit

The kit turns a JSON screenplay into an animated mathematics lesson. A shot
contains a figure and spoken beats; each beat triggers drawing or movement.
The same stage renders video frames and draws lessons live in the browser,
synchronized to narration.

Approved films appear beside their problem type's written lesson in AMP.
The learner and review pages use the same live player and stage. The curated screenplays in
`lessons/` provide worked examples; `design/` contains teaching designs and
tool proposals, including tools not yet implemented.

## Setup and checks

Use Node.js 22 and run these commands from `amp/`:

```sh
npm ci
npm run film:test
npm run tsc
npm run film:build
```

Unit tests need no credentials, audio or browser. Rendering and layout checks
need Playwright Chromium (`node scripts/install-browser.mjs`); media export
also needs FFmpeg. Voice generation needs `ELEVEN_LABS_API_KEY` in the
environment and uses a paid service. `FILM_NO_VOICE=1` disables generation.

## Author and play

Read [AUTHORING.md](AUTHORING.md), the [process](design/PROCESS.md), and the
relevant family design before writing a screenplay.

```sh
npx tsx film/facts.ts rectangle-area
FILM_NO_VOICE=1 npx tsx film/make.ts rectangle-area --dry
# Paid production, when authorized:
npx tsx film/make.ts rectangle-area --check
npx tsx film/make.ts rectangle-area
npx tsx film/export-live.ts film/dist/data rectangle-area
npm run film:build
npx vite preview --config film/vite.live.config.ts --host 127.0.0.1
```

Open the preview's `/live.html?id=rectangle-area`. Export writes a screenplay,
timing and figure JSON plus AAC audio for each film and an `index.json`.
The build preserves the exported data directory. The player supports
landscape and portrait layouts, seeking and playback speed.

Production output defaults to `~/.local/share/amp-film/films`, voice cache to
`~/.local/share/amp-film/voices`, and renderer locks to
`~/.local/share/amp-film/locks`. Override them with `FILM_OUT`,
`FILM_VOICES` and `FILM_LOCKS`; `--out` overrides a render's output root.
Keep all generated media, timing, caches and review records outside Git.

Screenplays name speakers. A speaker key maps to a role kind (`teacher`,
`learner`, `narrator`; the list lives in [voices.ts](voices.ts) and can grow).
Keys that are themselves kinds may omit the kind, so existing screenplays stay
valid. A film may have several speakers of one kind. The
[voice registry](voices.ts) binds teachers to Madeline or Paul and learners to
Champ. The film ID chooses a stable default teacher. The learner is Champ, and
two speakers of one film never share a voice. A film with more speakers of one
kind than approved voices of that kind still passes `--dry`; voicing fails
instead of reusing a voice. Use
`--voice teacher=paul` for an explicit edition; exact voice IDs are saved with
timing, keyed by speaker key, so playback uses the recorded voice. Solo films
retain their narrator behavior. Adding a voice is one entry in `voices.ts`.

The optional `critic.py` and `judge.py` tools produce private review reports.
The former requires `FILM_CRITIC_URL` and `FILM_CRITIC_MODEL`; the latter
requires an authenticated Codex CLI. Neither is part of CI or a substitute
for reviewing the lesson. Publishing is governed by the
[YouTube operating policy](../../docs/youtube-publishing.md).

## Publish approved films to AMP

After the founder approves an export on the review page, commit its screenplay
in `film/lessons/`. From `amp/`, run:

```sh
npm run film:publish
```

Publishing requires the AWS CLI and the `trash` command for temporary-file cleanup.
The command reads the operator's private `corpora/amp/film-publish.json` under
the OS configuration directory (`$XDG_CONFIG_HOME`, or `~/.config`). Configure
`reviewDir` for the review export's data directory, `bucket` and `profile` for
the existing media publisher, and `originPrefix` for the CDN origin prefix
(`artifacts`). `AMP_FILM_PUBLISH_CONFIG` can select another configuration file.
AWS credentials use the provider chain; never put credentials in this file.

Only an explicit approval of the current review edition qualifies: the
founder's grade of it, or a director's follow-up to his approval of an earlier
edition. The command
checks the exported screenplay against Git HEAD, validates timing and voice
bindings, uploads data and narration to content-hashed CDN paths, and verifies
their bytes and browser access. It writes `src/content/films/manifest.json`
only after every readback succeeds. Commit that manifest and ship it through
the normal trunk PR gates; the app deploy includes the film links. Repeating the
command verifies existing immutable files. `-- --check` validates without writing.
Removing every approval writes an empty manifest, withdrawing all film links.
If more than one edition of a problem type is approved, choose one on the review
page before publishing. A screenplay may list further problem types in
`teaches`, usually the rest of its skill; publishing links the film from each
of them too, except a type with an approved film of its own, which always wins.
A type taught by two such films is reported and gets neither until one
screenplay drops it. `teaches` is not part of the reviewed film, so changing it
needs no new review. Review records, notes, voiced data and audio stay outside
Git. A film with a shot's own app figure (`{"scene": ...}`) is published as
`lesson-film-v3` and reaches only clients that declare it; other films also
reach `lesson-film-v2` and `lesson-film-v1` clients. Clients that declare none
receive written lessons only.

When the founder approves a film with notes, the director applies them, exports
the result as a new edition (its own `added` stamp in the review index) and
records a follow-up with `npm run film:publish -- --follow-up <film-id> --note
"<what changed>"`. The follow-up is written to `followups.json` beside the
grades and publishes nothing; `-- --check` names the films it releases. It
counts only while the founder approval it answers stands and the media are
unchanged since; his grade of the new edition decides on its own, and a
follow-up never releases a rejected film.

Approvals without a screenplay committed in Git HEAD are reported and skipped.
Commit those screenplays and rerun the command to include them. Uncommitted
changes to an existing screenplay or mismatched reviewed media stop publication.
