# U10 7v7: The Playbook

**Status: Historical Artifact**

This is the "before" book — a complete U10 7v7 coaching system written before the author ever coached a single practice. It contains 12 chapters covering formation, positions, set pieces, practice plans, game day, roster management, and season planning.

The book is preserved as-is with a preface added for context. It represents months of preparation and research, and some of its ideas survived into real coaching. But the core tactical system (formation codes, three-shape transitions, complex rotation models) turned out to be too complicated for real nine-year-olds in real games.

## The Book Series

1. **The Playbook** (this book) — Written before coaching. The theory.
2. **1-2-3: A U10 Field Guide** (`../01-field-guide/`) — Written during the first season, after five games. The practice.
3. **Book Three** — Planned for after a full season. The reflection.

## Building

Requires pandoc and xelatex with the memoir document class.

```bash
./build.sh                    # PDF + EPUB at 6x9
./build.sh --paper=letter     # letter size
./build.sh --pdf-only         # PDF only
./build.sh --list             # list chapters
```
