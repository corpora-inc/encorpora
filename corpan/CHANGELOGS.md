# Release notes — conventions across the Corpán ecosystem

We ship multiple things from this repo. Each shippable unit keeps its own
`CHANGELOG.md`, colocated with the manifest that pins its version. Future
agents and humans should be able to land in any one of these directories
and read the recent history without spelunking through git.

## Where each `CHANGELOG.md` lives

| Unit                     | Path                                       | Version source                       |
|--------------------------|--------------------------------------------|--------------------------------------|
| Core app (Corpán)        | `corpan/corpan-app/CHANGELOG.md`           | `package.json`, `Cargo.toml`, `tauri.conf.json` |
| Packs (live + WIP)       | `corpan/packs/<pack>/CHANGELOG.md`         | `manifest.json` `version`            |
| Tauri plugins            | `corpan/plugins/<plugin>/CHANGELOG.md`     | `Cargo.toml` `version`               |
| Narration series         | `books/<category>/<series>/CHANGELOG.md`   | per-book `manifest.json` `version`   |
| The web/site             | `web/io/CHANGELOG.md` (only if needed)     | n/a (continuous deploy)              |

A "shippable unit" is anything that gets a version number, gets bundled,
or gets deployed. If it has a manifest with a `version` field, it should
have a `CHANGELOG.md` next to it. New shippable units start with a
`## [Unreleased]` stub on day one — no excuse to defer.

## Format

[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) — strict.

```markdown
# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- ...

### Changed
- ...

### Fixed
- ...

## [0.1.0] - 2026-01-15
- Initial release.
```

Section vocabulary (use only what fits the change set):

- **Added** — new features.
- **Changed** — behavior changes that aren't strict additions or fixes.
- **Deprecated** — soon-to-be-removed features.
- **Removed** — features removed this release.
- **Fixed** — bug fixes.
- **Security** — vulnerabilities addressed.

Keep entries short. One line per change. Link the PR (`#NNN`) when
useful. Lead with the user-visible effect, not the implementation:

- ✅ "Onboarding now lets users skip the learning-language picker."
- ❌ "Removed `canProceed` gate from `OnboardingPickLearning.tsx`."

## When agents should update the changelog

**Every time you touch a shippable unit, append to its `[Unreleased]`
section.** Don't batch — by the time someone bumps the version, they
shouldn't have to reconstruct the diff. If you're adding a feature,
fixing a bug, or making a behavior-visible change, that's an entry.

When an agent or human bumps the version (e.g. `package.json`,
`Cargo.toml`, `manifest.json`):

1. Promote the `[Unreleased]` block to a versioned entry with today's
   date in `YYYY-MM-DD`.
2. Add a fresh empty `## [Unreleased]` block at the top.
3. Verify the `version` field in the manifest matches the new heading.

If the change crosses units (e.g. a Corpán app feature that requires a
plugin bump), add the entry to *each* affected unit's changelog.

## Publish a Free2z page for big releases

For notable releases (and whenever we ship a batch of new videos), publish a
public announcement/marketing page on Free2z as part of the release. It is a
durable, linkable page we control, with embeddable video. See
`corpan/infra/free2z/README.md` for the Free2z-flavored Markdown reference, the
`post_zpage.py` helper, and the step-by-step checklist.

## What does NOT belong in a changelog

- Internal refactors with no observable effect.
- Comment-only edits, formatting, dependency updates that don't change
  behavior.
- Anything you'd embarrassed to read in a release announcement.

If you're unsure, lean toward including it — a too-detailed changelog
is easier to skim than reconstruct.

## Cross-references

- Root agent guide: `corpan/CLAUDE.md`.
- Per-unit `AGENTS.md` files (where they exist) inherit these rules and
  can add unit-specific guidance.
