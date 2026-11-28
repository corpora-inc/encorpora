# Hand-labelled warnings and cautions

`guards-sheet.csv` is the sheet a reviewer fills in for a sample of about 100 WARNING, CAUTION and NOTE
blocks from real pages, so the ingest's attachments can be scored without a full answer key. One row
per printed block:

| column | what to write |
|---|---|
| `source_id` | the corpus source id (from the corpus YAML) |
| `page_label` | the printed page label where the block is ("2-1475") |
| `block_kind` | WARNING, CAUTION or NOTE, as printed |
| `block_text_start` | the first five or more words of the block's text, exactly as printed (after the heading) |
| `guards` | what it guards: `step`, `procedure` (the whole task), `tree` (the whole troubleshooting task), `question` (one question box), `heading` (a chapter or section), or `none` |
| `guards_page_label` | the page of the step, task title, question or heading it guards |
| `guards_text_start` | the first five or more words of that step, task title, question or heading, as printed |
| `labeller`, `date`, `notes` | who, when, anything unusual (a block beside rather than above its step, a block for two steps) |

The three rows in the file are examples from the fictional pump proof manual; delete them for a real
sheet. Score a built pack against a filled sheet (no model call):

    harvest-bake maint labels CORPUS.yaml --pack PACK_DIR --sheet guards-sheet.csv

It reports, per kind: blocks found in the pack, attached at all, attached to the labelled target, and
each disagreement with both versions.
