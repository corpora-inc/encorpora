# State outline sources

Arkansas (FIPS 05) and Arizona (FIPS 04) were extracted from [U.S. Atlas 3.0.1 states-albers-10m.json](https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json), which redistributes the U.S. Census Bureau’s 2017 cartographic state boundaries. [Source documentation](https://github.com/topojson/us-atlas).

The SVG path decodes the TopoJSON delta arcs, preserves their existing Albers projection, translates to a local bounding box with three units of padding, and rounds coordinates to two decimal places. No state border was drawn by hand. This is decorative geographic artwork, not an official program mark or approval seal.

Source SHA-256: `6e7bb086a3c791490361968a3094f377f7726c5d0c4900fec03cc42db2305a3d`.

## U.S. Atlas license

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
