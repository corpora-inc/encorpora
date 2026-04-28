# What Men Live By — Pipeline State

## Status: GENERATING RUSSIAN TTS

### What's done:
- Directory structure created
- manuscript/what-men-live-by.md — Russian source (5890 words, 12 chapters + epigraph)
- segments.json — 620 segments (14 heading, 606 text, 114 dialogue)
- manifest.json — book_tolstoy_what_men_live_by, primary_language: ru
- narration.yaml — copied from Three Questions (all 23 languages configured)

### Translations: ALL 22 COMPLETE
ar, da, de, el, en, es, fi, fr, he, hi, it, ja, ko, ms, nl, no, pl, pt, sv, sw, tr, zh

### Russian TTS Generation:
- 599/606 WAVs generated, in alignment/validation phase
- Process PID running ~46 min
- M4As will appear in batch after validate → trim → master

### Running process:
```bash
# Check status:
ls /home/skyl/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/packs/ian-chatterbox-v1/segments_*.json | wc -l

# Continue translation if needed:
/home/skyl/tts_venv/bin/ttsctl translate \
  /home/skyl/encorpora/books/literature/tolstoy-short-stories/what-men-live-by/packs/ian-chatterbox-v1 \
  --provider gemini --vertexai \
  --langs el,en,es,fi,fr,he,hi,it,ja,ko,ms,nl,no,pl,pt,sv,sw,tr,zh
```

### Next steps after translation:
1. Generate Russian TTS (smoke test 5 segments, present WAVs to user)
2. Generate English TTS
3. Scan for pops, plateaus
4. Polish, master, audit
5. Publish as PREMIUM tier (paid product, $0.99)

### Notes:
- 620 segments is 7x larger than Three Questions (82 segments)
- Translation is slow (~15 min per language with any provider)
- Consider: user suggested using codex CLI for translation
- The epigraph has Latin numerals (I, III, IV) and Arabic numbers — may need tts.text cleanup
