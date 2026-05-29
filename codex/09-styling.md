# 09. Styling

> Note for any reader following an earlier outline: this manual's
> original brief said the app uses "no Tailwind, no framework."
> The current code uses Tailwind v4 plus shadcn/ui plus Radix
> primitives plus CSS custom properties. The brief was out of date;
> this section documents what is actually in the tree.

## What it is

The Corpán app's UI is styled with a stack of four cooperating
layers. **Tailwind v4** provides the utility classes (every
`className="flex items-center gap-2"` you read in
`MainExperience.tsx` is Tailwind). **shadcn/ui** provides the
component primitives (the `Button`, `Dialog`, `Drawer`, etc. files
under `src/components/ui/`), copied into the repo as source rather
than imported from a package so they can be edited freely.
**Radix UI** sits under shadcn, providing the accessibility-correct
behavior for popovers, dialogs, sliders, and so on. **CSS custom
properties** (variables) on the `:root` and `.dark` selectors
declare the design tokens (colors, radii) that Tailwind classes
consume by name.

The pack-side aesthetic family is a separate matter. Several packs
(Stargate Reader, Earthgate Reader, Quest-Ear) lean into a
warm-earth-tones / mid-century-science look that is its own visual
vocabulary; that vocabulary lives in those packs' own stylesheets,
not in the host app's design tokens. See section 11 for the pack
anatomy.

## How it fits

Styling is the layer the user actually sees. Every component the
React tree (section 06) renders ends up with classes that resolve
through Tailwind into CSS that the webview paints. The CSS variables
on `:root` are the slot where the design tokens live, so a single
edit at the variable level rolls through every component that uses
the token.

The styling stack also draws the line between the host app and the
packs. Packs ship their own CSS in their `dist/` output and load it
through the pack's `manifest.json` (section 11). The host's design
tokens are not exposed to packs by default; a pack that wants the
same look as the host imports the host's color values directly, or
builds its own.

## Files and entry points

- `corpan/corpan-app/tailwind.config.cjs`: the Tailwind config. Small.
  Contains a `safelist` of opt-in classes (the text-size classes),
  a `breathe` keyframe animation for the speak button's pulsing
  state, and not much else. No theme override beyond the keyframe.
- `corpan/corpan-app/src/index.css`: 322 lines. The single global
  stylesheet. Tailwind v4 directives at the top
  (`@import "tailwindcss"`, `@import "tw-animate-css"`,
  `@custom-variant dark`), all the CSS custom-property
  declarations on `:root` and `.dark`, a small set of
  hand-written rules (`body` font-size, the `.no-scrollbar`
  utility, the `.text-small`/`text-medium`/`text-large`/
  `text-extra-large` opt-in classes), and a careful collection of
  commented-out scaffolding from earlier iterations of the layout.
- `corpan/corpan-app/components.json`: the shadcn/ui config. Names
  the style preset (`"new-york"`), the base color (`"neutral"`),
  the alias prefixes (`@/components`, `@/lib/utils`, etc.), and
  the icon library (`"lucide"`).
- `corpan/corpan-app/src/components/ui/`: the eleven shadcn
  primitives currently imported (`badge.tsx`, `button.tsx`,
  `dialog.tsx`, `drawer.tsx`, `label.tsx`, `popover.tsx`,
  `select.tsx`, `separator.tsx`, `slider.tsx`, `switch.tsx`,
  `tabs.tsx`). These are the only `.tsx` files in the app that
  are explicitly "vendored": they are shadcn's output, edited in
  place when needed.
- `corpan/corpan-app/src/lib/utils.ts`: holds the `cn()` helper
  (a `clsx` + `tailwind-merge` wrapper) that the shadcn components
  use to compose conditional class lists.
- `tauri-plugin-safe-area-insets-css` (in `corpan-app/Cargo.toml`):
  Tauri plugin that exposes `env(safe-area-inset-*)` as CSS custom
  properties so the React layer can pad around the iPhone notch
  and Android display cutout.

## How it works

### Utility classes, briefly

Tailwind's model is that you do not write CSS class names; you
compose them from a fixed vocabulary of utilities, applied directly
in the JSX. So instead of writing:

```css
.meta-chips {
    position: fixed;
    top: 1.75rem;
    left: 1.25rem;
    z-index: 50;
    pointer-events: none;
}
```

…the same intent in `MainExperience.tsx:99` is:

```tsx
<div className="fixed top-7 left-5 z-50 pointer-events-none">
```

Each space-separated token is a Tailwind utility class. `fixed`
applies `position: fixed`; `top-7` is `top: 1.75rem` (Tailwind's
default 4-pixel spacing scale, where `7` is `28px`); `left-5` is
`left: 1.25rem`; `z-50` is `z-index: 50`; `pointer-events-none`
is exactly that. There is no `meta-chips` selector; the styling
lives at the call site.

The argument against this approach is that JSX gets cluttered with
class soup. The argument for it is that the cluttered call site
tells you exactly what the element looks like, and refactoring a
component does not leave an orphaned `.meta-chips` class behind in
a stylesheet nobody reads.

### How Tailwind v4 plugs in

Tailwind v3 ran as a PostCSS plugin and required a long
`tailwind.config.js` that enumerated the design tokens it would
emit. Tailwind v4 reverses the polarity: the design tokens live in
CSS custom properties on `:root`, Tailwind reads them at build
time, and the JavaScript config shrinks to (in this codebase)
keyframes and a safelist. The Vite plugin `@tailwindcss/vite`
(installed in `corpan-app/vite.config.ts:3`) wires it all together;
the developer never thinks about PostCSS.

The CSS in `index.css` opens with the v4 directives:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));
```

`@import "tailwindcss"` brings in the utility classes themselves.
`tw-animate-css` adds an animation utility set on top. The
`@custom-variant` line registers `dark:` as a variant that fires
when any ancestor has the `dark` class; this is how dark mode is
opted into per-tree rather than per-element.

### Design tokens as CSS variables

The middle of `index.css` declares two color systems, one for
light and one for dark:

```css
:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --primary: oklch(0.205 0 0);
    --primary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.556 0 0);
    --accent: oklch(0.97 0 0);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --ring: oklch(0.708 0 0);
    /* ... and more, including chart and sidebar tokens ... */
}

.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    /* ... a complete mirror set ... */
}
```

A few things to read off this:

- The token names (`--background`, `--foreground`, `--primary`,
  etc.) are exactly the names shadcn/ui's components expect. Pulling
  in a shadcn component "just works" because its `bg-background`
  and `text-foreground` classes look up exactly these variables.
- The values are in **OKLCH**, a perceptually uniform color space.
  `oklch(0.97 0 0)` is "a very light neutral gray." Same-numeric
  changes look like same-visual changes; this is the property RGB
  and HSL famously lack.
- Switching themes is one class change at the root: add `dark` to
  `<html>` and the entire token table flips.

A second block immediately below it maps Tailwind's color slots to
these tokens (`--color-background: var(--background)`, etc.), so
classes like `bg-background` resolve through Tailwind's color
machinery to the OKLCH values.

### shadcn/ui as source, not a dependency

shadcn/ui is not an npm package the app installs. It is a CLI that
copies React component sources into the project's tree. The
`components.json` configuration tells the CLI where to put them
and what style to use; once they are in `src/components/ui/`, they
are part of the codebase. Edits stick.

A shadcn component is two things woven together: a Radix primitive
for behavior, and Tailwind classes wrapped in
`class-variance-authority` (CVA) for variants. The `Button`
component at `src/components/ui/button.tsx:7` is the canonical
example:

```tsx
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all ...",
  {
    variants: {
      variant: {
        default:     "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive: "bg-destructive text-white shadow-xs hover:bg-destructive/90 ...",
        outline:     "border bg-background shadow-xs hover:bg-accent ...",
        secondary:   "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost:       "hover:bg-accent hover:text-accent-foreground ...",
        link:        "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 md:h-11 px-4 py-2 has-[>svg]:px-3",
        sm:      "h-8 md:h-10 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg:      "h-10 md:h-12 rounded-md px-6 has-[>svg]:px-4",
        icon:    "size-9 md:size-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)
```

Read this top to bottom:

- The first argument to `cva` is the **base classes** every button
  always has.
- The `variants.variant` object enumerates the six shapes a
  button can take. The `default` variant uses the design tokens
  through their Tailwind class names (`bg-primary`,
  `text-primary-foreground`); changing the `--primary` variable
  reshapes the button without touching this file.
- The `variants.size` object uses Tailwind's responsive prefix
  (`md:h-11`) to grow the button on tablet-and-up widths. The
  comment in place documents why: the iPad has the screen real
  estate for a 44pt-friendly tap target (Apple HIG minimum), but
  phones keep the denser sizing so tool palettes stay scannable.
  This is a single source of truth for that decision; it lives
  next to the component, not in a separate "responsive design"
  doc that would rot.
- `VariantProps<typeof buttonVariants>` is a TypeScript type
  (section 07) that extracts the shape of those `variant` and
  `size` keys. Misspelling `<Button variant="default" />` as
  `<Button variant="defualt" />` fails to compile.

### The `cn()` helper

The shadcn components are sprinkled with calls to `cn(...)`:

```tsx
className={cn(buttonVariants({ variant, size, className }))}
```

`cn` is a small wrapper around `clsx` (which merges class names
conditionally) and `tailwind-merge` (which resolves Tailwind
conflicts, so `cn("p-4", "p-2")` becomes `"p-2"` rather than both).
Without `tailwind-merge`, allowing the caller to override padding
on a vendored component would produce both classes and the
visual outcome would depend on rule ordering. With it, the last
one wins, predictably.

### Safe-area insets

The Tauri plugin `tauri-plugin-safe-area-insets-css` exposes the
device's safe-area inset values as CSS custom properties
(`--safe-area-inset-top`, `--safe-area-inset-bottom`, etc.). The
React code reads them via the helpers in `util/browser.ts`
(`getPlatformBottomPadding`, `getPlatformTopPaddingButtons`) and
applies them as inline styles. The commented-out block at the
bottom of `index.css` is an earlier attempt at handling this
purely in CSS by patching `[class~="fixed"][class~="bottom-0"]`
to lift the element by `var(--safe-area-inset-bottom)`. The
current approach moved the logic into JS instead; the commented
CSS is preserved as a record of what was tried.

This is the texture of the layout work in the codebase: there are
a few small in-place comments where commented-out CSS is left as
a paper trail of "we tried this, it didn't quite work, here is the
shape it had." Keep them. They are the cheap version of an ADR.

### The breathe animation

`tailwind.config.cjs` declares one custom animation:

```js
keyframes: {
    breathe: {
        '0%, 100%': {
            transform: 'scale(1)',
            opacity: '1',
            boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.4), 0 4px 6px -4px rgba(168, 85, 247, 0.4)',
        },
        '50%': {
            transform: 'scale(1.05)',
            opacity: '0.95',
            boxShadow: '0 10px 15px -3px rgba(168, 85, 247, 0.6), 0 4px 6px -4px rgba(168, 85, 247, 0.6)',
        },
    },
},
animation: {
    breathe: 'breathe 2s ease-in-out infinite',
},
```

That animation is the gentle pulse on the speak button while TTS is
playing. The purple is the Corpán accent color (also the pack-chip
purple in `MetaChips`). The `framer-motion` library handles the
larger transitions in the React layer (`useReducedMotion` in
`MainExperience` respects the OS-level preference); these CSS-side
keyframes handle the small ambient loops where a state machine
would be overkill.

## Common operations

1. **Change a design token.** Edit the value in `:root` (and the
   `.dark` counterpart) in `src/index.css`. Every component that
   uses the token through `bg-primary`, `text-foreground`, etc.
   picks up the change on the next dev-server tick.
2. **Add a new shadcn component.** From `corpan/corpan-app/`,
   run the shadcn CLI: `npx shadcn@latest add <component>`. The
   CLI reads `components.json`, fetches the source, and writes
   it into `src/components/ui/`. Commit the new file; the
   component is yours to edit.
3. **Style a new element with Tailwind.** Write the classes
   directly in `className`. Use the design-token classes
   (`bg-background`, `text-foreground`, `border-border`,
   `text-muted-foreground`) when the styling should follow the
   theme; use raw color classes (`bg-purple-500`) when the color
   is fixed and intentional.
4. **Add a variant to a vendored component.** Edit the `variants`
   object in the component's `cva(...)` call. TypeScript's
   `VariantProps` type updates automatically; every call site
   gets the new variant in autocomplete.
5. **Use a class only when a class name is on a parent.** Use the
   `dark:` variant for dark mode (`dark:bg-input/30`), the
   `md:`/`lg:` variants for viewport widths, or define a custom
   variant in `index.css` with `@custom-variant`.
6. **Hide the scrollbar on a scrolling pane.** Add the
   `no-scrollbar` class declared in `index.css`. It targets all
   the scrollbar pseudo-elements across Blink, WebKit, and Gecko.

## Why we built it this way

Tailwind plus shadcn is the combination that gives the small team
the most pixel-accurate output for the least ceremony. Tailwind's
utility classes mean the visual change to "make this card 8 pixels
tighter on the right" happens at the call site without any name-the-
class ritual; shadcn's vendored components mean the visual
adjustments that would normally require contributing back to a
component library happen in our own tree, in the same PR as the
feature that motivated them.

CSS custom properties on `:root` are the token layer that lets the
two cooperate. The shadcn primitives expect the token names; the
Tailwind v4 color machinery reads through them; the dark mode is
one class away. Adding a third theme (the warm-earth-tones aesthetic
the pack family explores) would mean a third selector with a third
set of tokens. The token machinery is built for that.

The pack/host stylistic split is deliberate. Packs are visual
experiments; they want different fonts, different colors, different
densities. Forcing them to inherit the host theme would defeat the
point. The host stays neutral so the packs can be loud, and the
host's tokens are not propagated into packs at all.

The commented-out CSS in the corners of `index.css` is the small
practice that earns the bigger principle: keep the paper trail.
The next time the safe-area-inset story comes up, the person who
opens the file sees that the CSS-only approach was tried and
gives up and finds the JS-based version on the first try.

## To go deeper

- The Tailwind v4 docs at `tailwindcss.com/docs`. Start with
  "Theme" (the v4 CSS-variable model) and "Editor setup" (the
  IntelliSense extension is the single largest productivity
  multiplier in this codebase).
- shadcn/ui's site at `ui.shadcn.com`. The "Components" pages
  show what is available; the "CLI" page documents
  `npx shadcn@latest add ...`.
- Radix UI's primitives at `radix-ui.com/primitives`. Worth
  reading the "Dialog" and "Popover" pages once to understand
  what the shadcn wrappers are wrapping.
- "OKLCH in CSS" at `oklch.com` for an interactive picker. Useful
  the day you have to introduce a new token from a brand color
  and want to keep it perceptually consistent with the existing
  set.
