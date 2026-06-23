# Free2z release pages

We publish a public page on **[Free2z](https://free2z.com)** for every big
release — and whenever we ship a batch of new videos. It is a free, markdown-based
publishing surface we control, good for a durable, linkable announcement that
isn't an app-store listing or a tweet.

We post as the **`corpora`** account (profile: <https://free2z.com/corpora>).

- Live pages: <https://free2z.com/corpora>
- API docs: <https://free2z.com/api/schema/redoc/>
- F2ZM reference page (by Free2z): <https://free2z.com/free2z/zpage/flavored-markdown>

## Auth

Free2z uses **Knox token** auth. The header is:

```
Authorization: Token <knox-token>
```

The `corpora` account's token is a secret — **never commit it**. Export it before
running the helper:

```bash
export FREE2Z_TOKEN=<corpora knox api token>   # ask Skylar / pull from the vault
```

(You can mint/rotate a token with `POST /api/token/login/` using the account's
basic-auth credentials; see the redoc `token_login_create` operation.)

## Posting a page

Write the page as a Markdown file in this directory (e.g. `catch-up-2026-06.md`),
then use the helper:

```bash
# Create a published page
python post_zpage.py \
    --content catch-up-2026-06.md \
    --title "Corpán — pure learning, fully offline" \
    --description "<=255 char meta description used for the page's <meta> + social cards>" \
    --category EDUCATION \
    --tags "Corpán,language learning,offline,privacy,on-device AI,education" \
    --vanity corpan-pure-learning-2026 \
    --publish

# Leave off --publish to create a DRAFT (is_published=false) for review first.

# Edit an existing page (fix copy, swap in new videos) by vanity or free2zaddr:
python post_zpage.py --update corpan-pure-learning-2026 --content catch-up-2026-06.md --publish
```

`POST /api/zpage/` creates; `PATCH /api/zpage/{free2zaddr}/` updates. The
`zPageUpdate` body fields:

| Field                | Type    | Notes                                                        |
|----------------------|---------|--------------------------------------------------------------|
| `title`              | string  | ≤128 chars. **Required on create.**                          |
| `content`            | string  | ≤100,000 chars. The F2ZM body. **Required.**                 |
| `description`        | string  | ≤255 chars. Meta/social description; AI-generated if blank.  |
| `category`           | enum    | e.g. `EDUCATION`, `TECHNOLOGY`, `MUSIC`. See script for list.|
| `tags`               | array   | Free-form strings.                                           |
| `vanity`             | string  | `[-a-zA-Z0-9_]+`, ≤128. The URL slug. Set once; keep stable. |
| `is_published`       | bool    | `false` = draft.                                             |
| `is_subscriber_only` | bool    | Keep `false` for marketing pages.                            |
| `publish_at`         | datetime| Optional scheduled publish.                                  |
| `featured_image`     | int     | Optional uploaded-image id (header image).                   |

Published URL: `https://free2z.com{get_url}` →
`https://free2z.com/corpora/zpage/<vanity>`.

## Free2z-flavored Markdown (F2ZM) — what you can use

F2ZM is a superset of GitHub-flavored Markdown. The pieces we actually use:

### Embeds — videos and store links

Use the **`::embed[URL]`** directive (a leaf directive on its own line). It
handles YouTube **and ~1900 other providers** (Play Store, App Store, Vimeo, …)
by unfurling the URL into a rich card/player:

```markdown
::embed[https://www.youtube.com/watch?v=8OqlbR501MI]
::embed[https://play.google.com/store/apps/details?id=com.corpora.corpan]
::embed[https://apps.apple.com/us/app/corp%C3%A1n/id6746082061]
```

> **Note on `::youtube[URL]`:** the *documented and verified* directive is
> `::embed[...]`, and it renders YouTube correctly (it's what the `corpora`
> profile bio uses). Prefer `::embed` for YouTube unless/until `::youtube` is
> confirmed in the F2ZM reference page above.

### The rest

- **Math:** inline `$$...$$`, display math with blank lines around a `$$` block.
- **Code blocks:** fenced with a language; `{1,3} showLineNumbers` for highlights.
- **Mermaid:** a ```` ```mermaid ```` block renders a diagram.
- **QR codes:** `::qrcode[free2z.com]`.
- **GFM:** tables, task lists, `~~strikethrough~~`, autolinks, footnotes (`[^1]`).
- **Images:** `![alt](https://...)`.
- No emoji shortcodes, but literal emoji 🦖 are fine.

Full reference (live, by Free2z): <https://free2z.com/free2z/zpage/flavored-markdown>

## Where the videos come from

- **Corpán Captures** — app tours, feature demos, store-ready clips.
  Channel: <https://www.youtube.com/channel/UCb2uVEho9pDWrX83-BchBmw>
- **Corpán Studios** — original media: music videos and cinematic readings (NOT
  tutorials). Channel: <https://www.youtube.com/@corp%C3%A1n1>
  (channel_id `UCX8KVNGSlQ30ouwkq4m9ckA`).

Quick way to list a channel's latest videos + ids (no API key needed):

```bash
curl -s "https://www.youtube.com/feeds/videos.xml?channel_id=<UC...>" \
  | grep -oE '<yt:videoId>[^<]+|<media:title>[^<]+'
```

## Release-flow checklist

When we ship a notable release (and/or post new videos):

1. Draft the page Markdown here (one file per post; keep old ones for history).
2. Embed 2–6 relevant videos with `::embed[...]` — lead with a hero/tour clip.
3. Keep the voice on-brand: understated, elegant, honest. "Pure learning." No
   hype, no AI slop. (See the brand-voice note in CLAUDE.md / memory.)
4. `export FREE2Z_TOKEN=...` then run `post_zpage.py` (start as a draft if unsure).
5. Verify it renders: open `https://free2z.com/corpora/zpage/<vanity>` and confirm
   every embed unfurls.
6. Link the page from the release announcement / socials.

This step is referenced from `corpan/CHANGELOGS.md` (the release-notes flow).

## History

- `catch-up-2026-06.md` → <https://free2z.com/corpora/zpage/corpan-pure-learning-2026>
  (2026-06-09). Big catch-up post after a long gap: the product story through
  0.17.3 (offline-first, on-device tutor + STT, audiobook reader, Phrase Flip,
  Corpan City), with Captures tour/feature videos + two Studios pieces.
