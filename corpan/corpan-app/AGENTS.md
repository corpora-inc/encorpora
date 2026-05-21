# Corpán frontend — agent standards

Operational rules for AI agents shipping React + Tailwind + shadcn UI
inside `corpan-app/`. Read top-to-bottom on your first task; future
tasks, skim the headings. Each rule has a **Why** so you can judge
edge cases instead of pattern-matching blindly.

The project-level `corpan/CLAUDE.md` covers repo structure and the
Tauri/Django data flow — don't duplicate that here. This file is the
frontend taste guide.

---

## 1. Brand & voice

- Understated, elegant. "Pure Learning" tagline.
- Zero marketing hype, zero AI-slop adjectives, zero emojis in
  product UI or code (unless the user *explicitly* asks).
- Copy is direct and short. "Browse phrase packs" beats "Discover
  amazing phrase packs". "Get" beats "Get it now!".
- When in doubt about a string, ask. Strings are user-visible
  forever; over-clever copy ages worse than minimal copy.

---

## 2. Buttons — heights, hierarchy, hero CTAs

### 2.1 The single hero-button height

Every "primary action in a card or panel" button — Subscribe, Restore
Purchases, Developer Packs, Get/Update/Open/Remove in
`PackActions.tsx`, etc. — uses this exact height pair:

```tsx
className="w-full !h-11 md:!h-14"
```

= 44 px on phones, 56 px on iPad+. **All such buttons consistent.**

The `!` is required. shadcn's Button CVA has baked sizes (`h-9 md:h-11`
for default, `h-8 md:h-10` for `size="sm"`) that twMerge does sometimes
resolve correctly but inconsistently across variants. `!important`
makes the override deterministic.

If a button looks wrong, check it has both `!h-11` **and** `md:!h-14`
— forgetting `md:!h-14` makes the iPad version visually inconsistent
with siblings even though phones look fine.

### 2.2 Even taller "page hero" buttons

The Stacks-tab full-width hero CTAs (Browse phrase packs, Reconfigure
stack, TTS setup) use a different pattern — padding-driven, *not*
fixed-height:

```tsx
className="w-full h-auto rounded-md px-6 py-6 md:py-8"
```

`h-auto` is mandatory — without it, the shadcn `h-9 md:h-11` default
clamps the height and the `py-6` becomes inert padding crushed
inside a fixed-height box. This bug was shipped multiple times before
the rule landed. Always `h-auto` when using padding to drive height.

### 2.3 Don't invent new heights

If your button needs to be a different height than 2.1 or 2.2, stop
and ask the user. The system has exactly two button heights for a
reason — consistency reads as polish.

---

## 3. Drawers (Vaul)

### 3.1 Heights for bottom drawers

Phones get 90 vh (leaving ~80 px peek for swipe-dismiss). iPad+ gets
80 vh. Override the shadcn primitive's baked baseline with `!`:

```tsx
<DrawerContent className="!mt-2 !max-h-[90vh] h-[90vh] md:!max-h-[80vh] md:h-[80vh]">
```

The shared `components/ui/drawer.tsx` has
`data-[vaul-drawer-direction=bottom]:max-h-[80vh]` and `mt-24` baked
into every bottom drawer. Without `!mt-2` the drawer starts 96 px
below the screen top regardless of `h-`. Without `!max-h-[90vh]` it
clamps at 80vh even though `h-[90vh]` requests more.

**Don't edit `components/ui/drawer.tsx` to relax these.** Other
drawers (future) may depend on the existing defaults; override at
the call site.

### 3.2 Drawer chrome — phone vs iPad

On phones, hide the `DrawerHeader` entirely. The Vaul grab handle +
the search-input placeholder carry identity; a centered title row
just eats ~52 px:

```tsx
<DrawerContent className="...">
  <div className="hidden md:block">
    <DrawerHeader>
      <DrawerTitle>…</DrawerTitle>
    </DrawerHeader>
  </div>
  <BrowserOrContent />
</DrawerContent>
```

### 3.3 z-index — drawers from inside dialogs

A Drawer opened *from* a Dialog must sit above it. Convention:

- Dialog overlay/content: `z-[1100]`
- Vaul Drawer overlay/content: `z-[1200]` (already set in
  `components/ui/drawer.tsx`)
- Popover: `z-[1002]` (above app, below dialog/drawer — fine for
  in-drawer overflow menus)

Don't paper over a missing drawer by debugging Dialog overlay state.
99 % of the time it's z-index.

### 3.4 Lift drawer state to App root

The phrase-pack drawer is mounted once in `App.tsx` and opened via
`useDrawerStore.openPhrasePacks()` from anywhere. **Never mount a
drawer inside a scrollable container** — Vaul's touch handlers
hijack the parent scroll on iOS WKWebView. Mount as a sibling of
`SettingsModal`, not inside it.

---

## 4. Pills / chips / filter rails

Pill rows must **never wrap to multiple lines**. Use a single
horizontally-scrollable rail with edge fades, scrollbar hidden,
selected items sorted to the left:

```tsx
function PillRail({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="
        relative
        before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-4
        before:bg-gradient-to-r before:from-background before:to-transparent before:z-[1]
        after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-4
        after:bg-gradient-to-l after:from-background after:to-transparent after:z-[1]
      "
    >
      <div
        className="
          flex flex-nowrap gap-1 overflow-x-auto
          [-webkit-overflow-scrolling:touch] [scrollbar-width:none]
          [&::-webkit-scrollbar]:hidden
          px-2
        "
      >
        {children}
      </div>
    </div>
  );
}
```

Selected-first sort (stable thanks to boolean-to-number + JS sort
stability):

```tsx
[...items].sort(
  (a, b) =>
    Number(selected.has(b.id)) - Number(selected.has(a.id)),
)
```

Pill dimensions: `px-2.5 py-0.5 text-[11px]` for compact rails (in
drawers, dense filter rows). Use `px-3 py-1 text-xs` only when the
rail is the page's primary control.

**Don't** add a "More categories" overflow popover unless the user
asks — horizontal scroll + edge fades is the affordance. Selected-
first sort means active filters are always visible.

---

## 5. Cards

### 5.1 PhrasePackCard / PackCard compact mode

Compact mode (in drawers, packed grids) uses `p-3 pb-2.5 md:pb-3`.
The phone-only `pb-2.5` shaves 2 px off bottom padding where it
matters most. iPad keeps the spacious 12 px.

Full mode: `p-4`. No mobile shaving — the full card is used on
surfaces that already have room.

### 5.2 Card action area pattern

Installed-state cards use a **top-right cluster** for both activate
and manage actions, not a bottom action bar:

- Active/Inactive: **tappable pill** with `●` (active) or `○`
  (inactive) dot + label. Replaces the older "separate badge +
  Switch" pattern — one widget, one tap.
- Secondary actions (Remove, Update, etc.): **3-dot menu** via
  Radix Popover (pattern reused from `StacksManagerRenamePopover`).

CTAs (Install, Buy, Subscribe) stay bottom-anchored because they're
CTAs, not management surfaces.

### 5.3 Card topic subtitle

Keep the topic subtitle (`pack.topic !== pack.name`) visible on
mobile. It adds 12 px but communicates "what's this card about" at
a glance. The user has explicitly approved this trade-off.

---

## 6. Safe-area handling on Android

`env(safe-area-inset-bottom)` returns 0 on Android Tauri WKWebView.
The CSS plugin block in `src/index.css` is commented out — don't
re-enable it without verifying it works end-to-end on a real
device.

**Convention**: use a static `pb-16` spacer at the bottom of
scrollable surfaces that touch the Android nav bar:

```tsx
<TabsContent value="stacks" className="space-y-4 mt-8 pb-16">
```

For onboarding-style fixed-viewport surfaces, an inline
`<div className="h-8 pb-20" />` spacer at the end of the scroll
container works just as well.

Don't use `paddingBottom: "calc(env(safe-area-inset-bottom, 0px) +
1.5rem)"` and assume it works on Android — it adds only the 1.5 rem
fallback and the nav bar still eats the last 24 px of content.

---

## 7. Modals, popovers, native dialogs

### 7.1 Never `window.confirm` / `alert` / `prompt`

They are silent no-ops in Tauri WKWebView. Build an in-pack modal
instead. Canonical pattern:
`packs/pronunciation-coach/src/multiplayer/confirm.ts :: pmConfirm(...)`.

### 7.2 Popovers for overflow menus

Use Radix Popover (`@/components/ui/popover`) wrapping the menu in
`PopoverContent`. For 3-dot menus, the trigger is a plain `<button>`
with `MoreVertical` from `lucide-react` and `aria-label` set via
i18n.

---

## 8. i18n

### 8.1 Locale file beats `defaultValue`

`t("key", { defaultValue: "New copy" })` is **ignored** if the
locale JSON has an entry for that key. Always check
`public/locales/en/common.json` (and other locales) when updating
strings — the inline `defaultValue` is just the fallback when the
key is missing entirely.

### 8.2 Active UI language

Read via `useTranslation()` → `i18n.language` (BCP-47). Never read
from `useSettingsStore.languages[0]` directly for UI rendering —
`LanguageSynchronizer` mirrors it into i18next anyway, and the
i18next hook re-renders on locale change.

### 8.3 Locale fallback for catalog data

When resolving localized maps (`nameLocalized`, etc.), use the
`resolveLocalized(map, fallback, lang)` utility from
`contentPacks/phrasePackCatalog.ts`. Chain: exact → base lang →
zh-script siblings → `en` → bare fallback. Don't reinvent.

---

## 9. State management

- Persistent: Zustand stores in `src/store/`, persist via
  `zustand/middleware`. Bump version on breaking changes.
- Transient (per-session): Zustand store, no `persist` (see
  `store/drawer.ts`).
- One drawer/modal per file in `store/` — extensible without prop
  drilling.

---

## 10. Don'ts (these have all bitten us)

- **No `console.error → silent catch`.** Every catch logs visibly,
  even if the failure is "expected" (see `memory/feedback_noisy_errors.md`).
  Silent swallows cost hours of debugging downstream.
- **No comments restating the code.** Comments explain *why*: a
  hidden constraint, a workaround, a non-obvious invariant. If
  removing the comment wouldn't confuse a future reader, don't write it.
- **No emojis in code, copy, or commit messages** unless the user
  asks. Affects file headers, JSX strings, locale JSON, the lot.
- **No backwards-compat shims for unmerged changes.** When you
  rename or remove something, delete the old reference completely.
  Half-renamed code rots.
- **No `mt-24` / `max-h-[80vh]` accepted as "the default"** for
  drawers — always override at the call site per §3.1.
- **No bumping a button height to fix a layout issue.** The system
  is §2.1 or §2.2. If you need a third height, ask why.
- **No dev-loop assumptions.** When the user reports a UI bug,
  trust the report. Don't reach for "stale cache" or "needs reload"
  as the first explanation — that's almost never the cause and it
  wastes their time. See `memory/feedback_dont_blame_the_build.md`.

---

## 11. Dev loop (Android)

- Screencap: `adb exec-out screencap -p > /tmp/screen.png`. Pull the
  file with the Read tool to see it.
- Build: `npm run build` (or `npm run tsc` for type-only check).
  The user runs `npm run tauri android dev` themselves — don't
  trigger Android builds yourself, you'll hold cargo locks (see
  `memory/feedback_no_ios_builds.md`; same principle applies).
- HMR: assume it works for `.tsx`/`.ts` changes. Locale JSON
  changes may need a manual reload on device.
- Don't `adb shell input swipe` blind — it can hit other UI
  elements (drawer triggers, etc.) and produce misleading
  "screenshot doesn't match my fix" moments.

---

## 12. When in doubt

- Read the surrounding components in the same file/folder before
  inventing a new pattern. Most patterns are established.
- Ask the user before adding a new dimension to the system: a third
  button height, a new color, a fourth filter facet, a new top-level
  Zustand store. These look small but compound.
- One change at a time, screenshotted, before bundling more. The
  user iterates fast and would rather review 5 small changes than
  one mega-PR.
