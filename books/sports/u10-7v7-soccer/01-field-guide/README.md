# 1-2-3: A U10 Field Guide

**What Five Games Actually Taught Me**

A short, practical guide to coaching U10 7v7 soccer. Written during the first season, after five real games with real kids. Six chapters, about 25 pages. Covers the 1-2-3 formation system, working with different personalities and skill levels, game-day management, practice structure, and the art of constant adaptation.

This is the "during" book in a series:

1. **The Playbook** (`../00-the-playbook/`) — Written before coaching. The theory.
2. **1-2-3: A U10 Field Guide** (this book) — Written during the first season. The practice.
3. **Book Three** — Planned for after a full season. The reflection.

## Building

Requires pandoc and xelatex with the memoir document class.

```bash
chmod +x build.sh
./build.sh                    # PDF + EPUB at 6x9
./build.sh --paper=letter     # letter size
./build.sh --pdf-only         # PDF only
./build.sh --list             # list chapters
```

## Corpan Narration Pack

Every sentence in this book is written to stand alone as a language-learning utterance. The book is designed for future conversion into a Corpan narration pack.
