# AGENTS.md - Website (web/io/)

## Critical Rules for AI Agents

### DO NOT fabricate product descriptions
Always read the actual source code, README, and app manifests before describing any product. Every app and pack in this repo has real code you can inspect. Never invent features or descriptions.

### Brand Voice
The site tone is **understated and elegant**. "Pure Learning" is the tagline. Avoid marketing buzzwords, hype, or generic AI slop like "No Compromise" or "AI-Powered Learning, Built in the Open." Copy should be direct, concise, and honest.

### Product Facts (verify these against actual code before using)

- **Corpan**: Language learning app with downloadable packs. 50+ languages. iOS + Android. Has a web presence at /corpan/ with playable packs.
- **Homeschool Offline**: A private homeschool **journal/calendar** app. Track school days, add notes and photos, manage multiple students. 100% offline, no cloud. It is NOT a curriculum or K-12 content platform. Check `/homeschool-offline/` for the actual app code.
- **Hanzipan**: A Corpan pack (not a standalone app). Mandarin character studio.
- **Juice Squeeze**: A Corpan pack (not a standalone app). Phrase-building game. Currently a prototype.
- **Yijing**: I Ching oracle app. iOS + Android. Not featured on homepage.
- **PaKO A1**: Korean/English flashcard app. iOS + Android. Not featured on homepage.

### Logos
Each app has its own logo. Do NOT reuse the Corpan logo for other apps.
- Corpan: `/web/io/public/logos/corpan-logo.webp`
- Homeschool Offline: `/web/io/public/logos/homeschool-logo.webp` (smiley house icon)
- Yijing: `/web/io/public/logos/iching-logo.webp`
- PaKO: `/web/io/public/logos/pako-logo.webp`
- Hanzipan: `/web/io/public/logos/hanzipan-avatar.png`
- Juice Squeeze: `/web/io/public/logos/juice-squeeze-avatar.svg`

### YouTube
The YouTube channel features original music videos with AI-generated cinematography. It is NOT a tutorials/demos channel. The heading is "Original Media."

### Data Files
- `web/io/data/apps.json` - App registry (standalone apps with store links)
- `web/io/data/books.json` - Book listings
- `web/data/packs.json` - Corpan pack registry (packs that run inside Corpan)

### Infrastructure
- No Supabase (removed)
- No shop.encorpora.io (defunct)
- Google Ads tag `AW-17513523888` must remain in layout.tsx
- Static export via `next build` + `web/pages/build.js`
