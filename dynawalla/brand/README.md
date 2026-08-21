# Dynawalla brand

These files live in the repository on purpose. An earlier pass built them in a
scratch directory and lost the lot when the session ended — the vectorised mark,
the palette, the composed icon and the approved catalog mock, all gone in one
cleanup. Brand assets are product, not working notes. They belong here.

## The mark

`mark-source.png` is the founder's original, 1024×1024. `mark.svg` is the
hand-authored vector of it: deliberate geometry rather than a traced outline, so
it stays crisp from 16px to 1024px and recolours from `currentColor`.

It reads four ways at once, which is the point — an onion dome with a spire, a
gear at its heart, wings sweeping below, and a brain in the negative space.

The direction it serves, in the founder's words:

> futuristic space angels from the bible. gear brain angel minaret psychedelic ..
> sharp, pointing towards heaven, clockmaker G-d .. vaguely middle east .. like
> the power of learning in al-andalus subconsciously. angelic. flow state.

Explicitly dead, also his words: *"the dusty khaki sandstorm feel."* Do not
produce sandstone, brass-and-desert, or cream-and-terracotta.

## The palette

Sampled from the mark's own pixels, not invented. The dominant saturated pixel is
`#864DE8`; everything else is built outward from it.

| Token | Dark (default) | Light | Role |
|---|---|---|---|
| `--dw-ground` | `#0B0618` | `#F4F0FF` | The void the mark hangs in. Violet-black, never grey. |
| `--dw-surface` | `#150C2E` | `#FFFFFF` | Card and panel ground. |
| `--dw-edge` | `#2A1B4D` | `#DCD2F5` | Hairlines, borders. |
| `--dw-accent` | `#9258FF` | `#6D28D9` | Lit line art, active state, focus. |
| `--dw-accent-ink` | `#C9B4FF` | `#5B21B6` | Accent used as *text*. |
| `--dw-bloom` | `#B88CFF` | `#A78BFA` | Glow only. Never a fill, never text. |
| `--dw-apex` | `#FFE7B0` | `#B45309` | Warm gold. Once per screen, at the top of something. |
| `--dw-ink` | `#E8DEFF` | `#1A1033` | Body text. |
| `--dw-ink-muted` | `#B9A6EC` | `#5B5175` | Secondary text. |

Measured WCAG AA, dark theme: ink on ground 15.50, ink on surface 14.52,
ink-muted on ground 9.23, accent-ink on surface 10.19, apex on ground 16.43 —
all pass. **`--dw-accent` on ground is 4.81**, which clears AA for normal text by
a hair; prefer `--dw-accent-ink` for anything a child actually reads and keep
`--dw-accent` for line art, borders and state.

## Rules

- **Bloom is light, not paint.** A filled bloom-coloured shape reads as generic
  AI purple glow, which is the named failure mode for this brand.
- **One warm point.** `--dw-apex` appears once per screen.
- **Monoline.** The mark is a single stroke weight; borders and generated
  artwork inherit that discipline.
- **The void is violet.** `#0B0618`, never `#111111`.

## The icon

`icon-1024.png` is the mark extracted from its grey studio field and re-lit on
the violet void. It is copied to `dynawalla-app/src-tauri/icons/icon.png`.

Two constraints, both learned the expensive way:

- It **must stay RGBA**. `tauri::generate_context!` panics on anything else at
  build time.
- Do **not** pre-flatten the alpha. The Tauri CLI renders the iOS AppIcon set
  from this file and flattens it itself for the 1024 marketing icon, so
  ITMS-90717 cannot fire.

`*.png` is Git LFS repo-wide, so both PNGs here are LFS objects.
