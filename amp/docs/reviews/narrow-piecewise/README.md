# Narrow piecewise prompts

These synthetic prompt captures render the actual piecewise generator through `MathText`, KaTeX and the practice styles. They isolate the problem stage; navigation and answer controls are outside these captures.

The check renders 150 deterministic seeds (`narrow-0` through `narrow-149`) at viewport widths 320, 390, 768 and 1280 in light and dark themes. Stage width is the viewport minus 62 pixels, capped at 760 pixels. Every prompt fits horizontally. Restoring the former 22px narrow prompt size produces overflow in 52 cases at 320px.

Prompts containing a KaTeX table use 18px text on viewports up to 380px. Ordinary prompts and wider screens keep their existing typography. Images show the courier example from seed `narrow-5`.
