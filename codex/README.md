# The Corpán Codex

A study manual for the architecture of Corpán, the product built by Corpora,
and through that documentation a working education in the disciplines of
modern software engineering.

## Purpose

Two jobs in one document, braided:

1. A reference manual for this specific system. Every technology, every
   script, every convention, every place state lives. Open it, read two
   sections, know exactly where to work.
2. A general programming education. Each technology is explained on its
   own terms, using real Corpán code as the example. The reader learns
   React, Rust, Tauri, Kotlin, SQLite, Python, TypeScript, Tone.js,
   Whisper, Chatterbox, Babylon.js, monorepo discipline, version control,
   and the philosophy of building systems that do not break.

Both happen at once. There is no separate tutorial section.

## Audience

One reader: someone roughly a year into learning programming, working
primarily with AI coding agents, catching the tail end of the era when
senior engineers built systems by hand and the beginning of the era when
most code is co-written with models. Not a senior engineer. Not a total
beginner. The agent-era apprentice who wants both worlds fluent before
the field shifts again.

## How to read this

Front to back works. Jumping in by topic also works. Every section is
self-contained enough to be useful alone, and cross-references the rest.

If you have twenty minutes and a specific question, start with
appendix E (`appendices/e-where-to-look.md`), a reverse index from
"I want to understand X" to "read file Y."

If you are new to the system, read sections 01, 02, and 03 in order.
Then jump where curiosity pulls.

## Table of contents

### Part I, The System
- [01. Overview](01-overview.md)
- [02. The Monorepo](02-the-monorepo.md)
- [03. Version Control](03-version-control.md)

### Part II, The App
- [04. Tauri](04-tauri.md)
- [05. Rust](05-rust.md)
- [06. React](06-react.md)
- [07. TypeScript](07-typescript.md)
- [08. Vite](08-vite.md)
- [09. Styling](09-styling.md)

### Part III, The Pack System
- [10. Packs Overview](10-packs-overview.md)
- [11. Pack Anatomy](11-pack-anatomy.md)
- [12. Pack Host API](12-pack-host-api.md)
- [13. Pack Catalog](13-pack-catalog.md)
- [14. Pack Shared State](14-pack-shared-state.md)
- [15. Pack Transport](15-pack-transport.md)

### Part IV, Data and Content
- [16. SQLite](16-sqlite.md)
- [17. Content Formats](17-content-formats.md)
- [18. Audio Assets](18-audio-assets.md)

### Part V, The Pipeline
- [19. Python in the Stack](19-python-in-the-stack.md)
- [20. Chatterbox](20-chatterbox.md)
- [21. Whisper](21-whisper.md)
- [22. The Spark](22-the-spark.md)
- [23. 3D and Creative](23-3d-and-creative.md)

### Part VI, Storage and Delivery
- [24. S3](24-s3.md)
- [25. Captures and YouTube](25-captures-and-youtube.md)
- [26. State Locations](26-state-locations.md)

### Part VII, Platforms
- [27. iOS](27-ios.md)
- [28. Android](28-android.md)
- [29. Desktop](29-desktop.md)

### Part VIII, The Toolchain
- [30. Languages](30-languages.md)
- [31. The Shell](31-the-shell.md)
- [32. Package Management](32-package-management.md)

### Part IX, The Agent Era
- [33. Working with Agents](33-working-with-agents.md)
- [34. What Humans Still Do](34-what-humans-still-do.md)
- [35. The Near Future](35-the-near-future.md)

### Part X, Recent Evolutions
- [36. Changelog of the System](36-changelog-of-the-system.md)

### Appendices
- [A. Glossary](appendices/a-glossary.md)
- [B. Conventions](appendices/b-conventions.md)
- [C. Commands](appendices/c-commands.md)
- [D. Reading List](appendices/d-reading-list.md)
- [E. Where to Look](appendices/e-where-to-look.md)

## Status

Skeleton. Every file present, every section stubbed `TODO`. Filled in
across many sessions, one section at a time. Surface gaps as they
appear; do not smooth them over.
