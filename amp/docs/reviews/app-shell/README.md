# One app frame (#2062)

Every signed-in app screen now sits in one frame, `app/AppShell.tsx`, mounted once at the router's root. These screenshots come from `scripts/verify-app-shell-stability.ts --engines chromium --shots docs/reviews/app-shell`, against the app-shell fixture's real API and data, at 390 and 1280 px in light and dark.

## On the frame

| Group | Screens | Tabs |
| --- | --- | --- |
| Progress | `overview`, `pathways`, `inventory`, `me` (an adult's own record), `trial-map` (the free assessment) | Overview, Pathways, Inventory |
| Account | `security`, `family`, `billing`, `privacy` | Profile & sign-in, Family, Billing, Privacy |
| Practice | `practice` | none: the topic and tools sit beside the logo |

`drawer-*` shows the one drawer, opened from the logo: where you are at the top, one link per group, the screen's settings, and who is signed in with Sign out at its foot.

## What the check asserts

At 390 and 1280 px, light and dark, in Chromium and WebKit, for every screen above:

- the logo's box is identical on every screen, and the open drawer's logo sits in that exact box;
- a group's tabs keep their boxes on every screen of the group, and moving between tabs keeps the same bar element;
- no layout shift from first paint to settled;
- no resource requested twice while a screen loads;
- no visible text changes without input in the first two seconds.

## Not on the frame yet

School and class screens (`SchoolFrame`, `OrgFrame`) keep their rail and sheet until the next change. The free assessment's practice (`/try/practice`) keeps its own frame until the trial moves into families. Sign-in, `/start`, the pitch, joining a class and public pages keep their own frames by design.
