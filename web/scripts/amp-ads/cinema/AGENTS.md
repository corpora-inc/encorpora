# AMP cinema ads: hard rules

Runbook: [README.md](README.md). These rules are not negotiable.

1. **Text is centred, always.** Every text card, the end card and the logo sit
   in the middle of the frame, horizontally and vertically, never at the top or
   bottom where Instagram, YouTube and TikTok overlay their header, caption,
   buttons and controls. The spec has no position fields, and the renderer
   measures each card's pixels against the format's safe area (`spec.FORMATS`)
   and refuses to render a card that leaves it. Never loosen the safe zones or
   the centring tolerance to make a card fit: shorten the words.
2. **Few, big words.** At most 10 words per card. Let picture and voice carry
   the story.
3. **No secrets or personal identifiers in Git.** API keys, OAuth tokens, voice
   generation URLs, account and channel IDs stay in the environment or the
   private infrastructure repository. Paths use `$AMP_MEDIA_ROOT`,
   `$AMP_MUSIC_POOL` and the other variables in the README, never a home
   directory. Receipts with absolute paths live in the media library, not here.
4. **GPU host etiquette.** Other work shares the host. Run
   `spark/spark.sh preflight` first. Generate only through `supervise.sh`
   and the guarded runner, which hold the shared `workload.lock` and stop on
   low memory or high temperature. Never touch another batch's directory,
   queue, status files or locks, never kill another job, and never run a
   download alongside generation (that combination has crashed the host). A
   new batch waits for the queue; it does not jump it.
5. **Upload private.** Follow [the shared YouTube policy](../../../../docs/youtube-publishing.md)
   for review, cadence, scheduling, comments, and pinned CTAs. Render approval
   does not authorize immediate public release. Paid use and campaign changes
   require the applicable explicit authorization.
6. **Provenance.** Never overwrite a render, batch or take. Changed inputs get
   `--replace` (old files move to `superseded/`) or a new id. Keep receipts.
7. **Look and listen.** QC proves the media decodes, is loud enough and has no
   black gaps. It does not prove the ad works. Watch every cut with sound, at
   phone size, before showing it.

Creative direction learned from founder review (October 2026):

- Lead positive: "Turn your math up to 11", not "stop worrying about math".
- Grab attention in the first two seconds and give something striking every
  few seconds after.
- The visual metaphor must show cause and effect. A gear that "clicks into
  place" but does not drive the machine illustrates nothing.
- Voices: Paul and Madeline. Natural reads; no hype, fake emotion or trailer
  voice. Verify every take's wording against the script.
- Product shots must be smooth: frame-by-frame captures, no jerks, no flashes.
