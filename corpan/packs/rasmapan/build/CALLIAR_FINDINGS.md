# Calliar — what's still on the table

A second-pass audit of the [Calliar dataset](https://github.com/ARBML/Calliar)
(MIT, ARBML) after Phase A + B were already shipped. Lists potential
additions to Rasmapan ranked by impact-per-effort.

---

## 1. Bismillah lesson (HIGH value, LOW–MEDIUM effort)

The dataset contains **62 recordings of "بسم الله الرحمن الرحيم"** (Bismillah
ar-Rahman ar-Rahim) — the Quranic opening phrase. Calliar even has a
dedicated extraction notebook (`Collect bism allah.ipynb`) confirming this
was a target during dataset creation.

Sample shape: each Bismillah recording is a **23-stroke trajectory** with
an identical primitive sequence across writers (verified across 3
samples). The whole 17-letter phrase is captured in one consistent
stroke order from real calligraphers.

**Rasmapan addition**: a "Your first phrase" lesson card that animates the
full Bismillah with stroke-by-stroke tracking. The user watches the pen
trace the whole 23 strokes in sequence, then traces it themselves at a
larger size on a wide canvas.

Why this works pedagogically:
- Bismillah is *the* first phrase most students of Arabic calligraphy
  learn — both for cultural reasons and because it efficiently
  exercises baa, siin, miim, alif, laam, haa, raa, Haa, nuun, yaa
  (11 of the 28 letters).
- We already have all the underlying mechanisms — same animation
  loop, same fx canvas, same Calliar-derived data.
- Picking the canonical recording across 62 samples is the same
  tortuosity-min / aspect-band selection we already use.

Effort: ~half a day. New seed entry, new lesson card type, new wide
canvas layout for the multi-letter trace.

---

## 2. Positional-form animations (HIGH value, MEDIUM–HIGH effort)

Currently tracing works at all 4 positional forms (init/medial/final/
isolated) but only **isolated** has Calliar-derived animation. Going to
positional forms means inferring position from context inside Calliar
samples.

Approach:
1. Walk each sample. For each stroke tagged with a primitive (say ٮ),
   look at its neighbors in the stroke list.
2. If preceded AND followed by other letter primitives → MEDIAL.
3. If only followed → INITIAL.
4. If only preceded → FINAL.
5. If neither → ISOLATED.
6. Per (primitive, position), apply the same tortuosity + aspect-band
   selection.

This lets us populate `forms.initial`, `forms.medial`, `forms.final`
in `stroke_orders_seed.json`. The build pipeline already routes
those overrides; we just need the data.

Effort: full day. The position-inference logic is the new piece;
everything downstream is identical.

---

## 3. Word-mode stroke-order animation (HIGH value, depends on #2)

Once positional-form data is in place, word-mode animation is small:
iterate the letters RTL, animate each letter's medians at its word-slot
transform, gap between letters. The infrastructure (WordTraceLayer
extends LetterTraceLayer; same fx canvas; same animation method
inherited) is already in place — we just need the right per-position
medians.

Effort: ~2 hours after #2 ships.

---

## 4. Multi-writer variation showcase (MEDIUM value, LOW effort)

Calliar's 2,500 samples come from many writers in different
calligraphic styles. We currently pick *one* canonical trajectory per
primitive. We could show the variety:

- Pick 3 cleanly-clustered trajectories per letter (Naskh-ish,
  Diwani-ish, Thuluth-ish).
- Add a "Master variants" section to each letter's Examples panel:
  three small panels showing different calligraphers' takes on the
  same letter, each animatable.

Pedagogical hook: "Different masters draw it slightly differently
— here are three classical versions."

Effort: ~3 hours. Hardest part is the clustering, but `notebooks/
Clustering Characters.ipynb` in upstream Calliar already does this.

---

## 5. Per-style sample-image generation (LOW value, MEDIUM effort)

Calliar ships a `pix2pix/` folder of ~3,000 paired
sketch/calligraphy images and a `Convert Strokes to Images.ipynb`
notebook. In principle we could generate a unique calligraphy
image *per style* showing بسم الله in that style.

But: we already use real-world PD manuscript samples from Wikimedia
Commons for the four style cards (commit `0d872a98`), which are
arguably more authoritative than generated images. Marginal value
unless we want stylistically-matched renderings of arbitrary phrases
(e.g. "your name in Diwani").

Effort: medium — requires running their model. Probably skip.

---

## 6. Bismillah-as-styles preview (LOW value, LOW effort)

Side idea: replace the four style cards' single image with a
short Bismillah animation rendered in that style's typical primitive
proportions (Naskh = our current set; Diwani = looser/curlier; Kufic
= angular). Cute but each style's "primitive shape" is approximate
since Calliar doesn't tag samples by style.

Effort: ~half day. Probably skip unless the user specifically wants
animated style cards.

---

## Recommendation order

1. **Ship #1 (Bismillah lesson)** — biggest cultural impact, smallest
   delta on the existing infrastructure. Half a day of work, dramatic
   user-visible result.
2. **Ship #2 (positional-form animations)** — completes the
   stroke-order story across every glyph variant. Full day.
3. **Ship #3 (word-mode animation)** — natural follow-on, half a day
   after #2.
4. Defer #4–6 unless there's appetite for further polish.

After #1 + #2 + #3 the pack is *complete* in the "every shape the
user sees gets a real-calligrapher animation" sense. That's the
v0.2 milestone.
