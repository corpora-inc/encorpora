# Interactive lesson models

Three lesson examples include SVG models with Play, Pause, Step and Replay controls:

- **Exchange equal units:** ten ones move into a ten rod; ten tens move into a hundred square. Each small square keeps its size. The full example appears above the focused group. A caption names the unchanged units, and the equation accounts for the total.
- **Fraction models:** a fixed whole gains equal partitions, then the shaded parts lift away. Their widths stay fixed, connecting the selected part count to the denominator.
- **Split arrays:** regions A and B separate and rejoin. Square cells retain their dimensions and count, showing how the two partial products compose the whole array.

The models read the lesson example’s semantic figure. They do not parse prompts or author a second worked example. Unsupported figures retain the ordinary renderer. Explanations and mathematical labels use the existing KaTeX presentation. The original method and solution follow the interactive model.

Motion starts only when the learner chooses a control. Each model has three discrete states; CSS transforms move existing SVG groups between them. The panel reserves 460 pixels while loading at the default text size. Captions share a grid cell sized to the longest state, so stepping does not shift surrounding content. Enlarged text can expand the panel, and long equations scroll within their own row. Reduced-motion preferences show the complete model with transitions disabled, including when the preference changes while it is open. Closing a lesson cancels its playback timer.

The renderer and its stylesheet load when a supported lesson opens. If that optional download fails, the ordinary figure and lesson stay available. There is no animation library, canvas loop or image asset. The small figure selector is available to the lesson shell. An example with changed figures remounts the model at its initial state.

Run `npx tsx scripts/verify-lesson-animation-ui.ts` from `amp/` for the isolated browser check. It uses generated lesson examples, an OS-assigned loopback port and no database. Screenshots at widths 320, 390 and 1280 and browser scheduling measurements are written to `artifacts/lesson-animation/`. The check covers controls, reduced motion, KaTeX, horizontal overflow, stable panel dimensions and delayed module loading. Set `AMP_ANIMATION_BROWSER=webkit` to exercise WebKit and write a separate `artifacts/lesson-animation-webkit/` set. The checks also exercise 200% text, keyboard focus, an unavailable animation chunk and reopening a lesson during playback. Desktop browser timings are not evidence of 60 fps on a mid-range phone; physical-device frame profiling is a separate verification requirement.

## Visual review references

The [fraction](lesson-animation/fraction-model-320-final.png), [split array](lesson-animation/split-array-part-320-step.png), [ten-to-hundred exchange](lesson-animation/exchange-base-ten-320-final.png), and [ones-to-ten exchange](lesson-animation/exchange-ones-320-final.png) references show the narrowest viewport. The same directory includes intermediate and final states at all three widths. Regenerate the screenshots and inspect their differences when changing geometry or typography; pixel equality across operating-system fonts is not an automated gate.

A production build measured the lazy renderer at 4.36 kB JavaScript (1.75 kB gzip) and 2.04 kB CSS (0.84 kB gzip). Headless Chromium on macOS sampled 89 frame intervals during fraction playback at each viewport: averages were 16.67 ms and maxima 16.8 ms. WebKit means ranged from 16.54 to 16.69 ms, with a maximum sampled interval of 27 ms. These measurements describe browser scheduling on the development machine, not rendering throughput on a phone. The browser harness also checks that each array cell is square, exchanged groups contain ten equal units, and lifted fraction pieces clear the original whole.
