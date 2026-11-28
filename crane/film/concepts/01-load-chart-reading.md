# Reading a load chart

Skills: `loadchart.read-gross`, `loadchart.radius-between-rows`, `loadchart.boom-between-columns`, `loadchart.deductions`, `loadchart.net-capacity`, `loadchart.chart-notes`, `loadchart.structural-vs-stability`. Exam domain: Load Charts (about 26%). Chart: our fictional HT-50, outriggers fully extended, 360° (`crane/content/tools/loadcharts/charts/ht-50.json`).

## The idea

A load chart cell is not "what the crane can pick up". It is the gross capacity for one setup, at one boom length and one radius. Everything hanging under the boom tip is part of the load, so the load you may hook on is the cell minus the block, the rigging and anything the chart says to deduct.

Radius is where the hook hangs: the level distance from the center of rotation to the hoist line, with the load on. Lower the boom and the radius grows, and the capacity falls.

## The moment

The boom lowers on screen. The radius readout counts up, and the capacity readout steps down, one chart row at a time. Later, the same 18,000 lb load that fits at 30 ft fails at 33 ft. Three feet of radius turns yes into no.

## Cases (three)

1. **Listed boom and radius.** 74 ft boom, 30 ft radius, 18,000 lb load. Column 74, row 30: 24,300 lb gross. Deduct the hook block (1,100), slings and shackles (300) and the stowed extension (2,400): 3,800. Net 20,500. 18,000 is less: it can lift.
2. **Between rows and columns.** 68 ft boom, 33 ft radius, same load and rigging. Never interpolate. The chart's own notes say: a radius between rows uses the next longer radius (35); a boom between lengths uses the next longer boom (74). Both are the weaker choice, so the answer stays safe. 21,400 − 3,800 = 17,600. 18,000 is more: it cannot lift.
3. **The notes under the chart are rules.** A blank cell means no load at all there (38 ft boom at 35 ft: the boom cannot reach). Shaded cells are limited by strength, not tipping: the crane can break before it shows any sign of tipping, so tipping is no warning.

## Close

Four steps: the page for the setup; the boom column and the radius row (next longer when between); gross minus everything under the tip is net; the load must be no more than net.

## Not in this film

Jib ratings, range diagrams, percent of capacity, on-rubber charts: their own films.
