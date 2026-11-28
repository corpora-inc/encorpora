"""The page model as prompt text: regions with ids, kinds and positions, then the drawn connectors.

    <page n="2" label="3-2" size="612x792">
    [p2.r4 box 40,72-572,126] INITIAL SETUP | Equipment condition: Pump stopped, start key removed. | ...
    [p2.r9 text 415,180-425,186] NO
    connectors: p2.r7 -> p2.r10 label p2.r9 "NO"
    </page>

Lines inside a region are joined with " | " so a model sees line structure without inventing it;
text fields are still matched against the region's words (the bars are not part of the text).
Coordinates are whole points from the top-left, so a text-only model can align a facet box with
the question beside it and read which box an arrow leaves and enters.
"""

from __future__ import annotations

from .layout import PageModel


def page_text(pm: PageModel, coords: bool = True, headers: bool = False) -> str:
    head = f'<page n="{pm.index}" label="{pm.label or ""}" size="{pm.width:.0f}x{pm.height:.0f}"'
    if pm.change:
        head += f' change="{pm.change}"'
    out = [head + ">"]
    for r in pm.regions:
        if not r.words or (r.kind in ("header", "footer") and not headers):
            continue
        tag = r.kind
        if r.kind == "cell":
            tag = f"cell r{r.row} c{r.col} of {r.parent}"
        elif r.parent:
            tag += f" in {r.parent}"
        if r.changed:
            tag += " changed"
        pos = f" {r.bbox[0]:.0f},{r.bbox[1]:.0f}-{r.bbox[2]:.0f},{r.bbox[3]:.0f}" if coords else ""
        out.append(f"[{r.id} {tag}{pos}] {pm.region_text(r, ' | ')}")
    conns = []
    for c in pm.connectors:
        lab = pm.region(c.label) if c.label else None
        s = f"{c.tail or '?'} -> {c.head or '?'}"
        if lab:
            s += f' label {lab.id} "{pm.region_text(lab)}"'
        conns.append(s)
    if conns:
        out.append("connectors (drawn arrows, tail -> head):")
        out.extend("  " + s for s in conns)
    out.append("</page>")
    return "\n".join(out)
