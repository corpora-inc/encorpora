#!/usr/bin/env python3
import os
import hashlib
import base64
import subprocess
from panflute import *
# from panflute import (
#     run_filter,
#     Math,
#     RawInline,
#     RawBlock,
#     Doc,
#     Element,
#     Para,
#     Str,

CACHE_DIR = "svgcache"
os.makedirs(CACHE_DIR, exist_ok=True)


def latex_to_svg(tex):
    # make a cache key
    key = hashlib.sha1(tex.encode()).hexdigest()
    svg_path = f"{CACHE_DIR}/{key}.svg"
    if not os.path.exists(svg_path):
        # write standalone TeX
        tpl = r"""\documentclass[preview]{standalone}
\usepackage{amsmath}
\begin{document}
%s
\end{document}"""
        with open(f"{CACHE_DIR}/{key}.tex", "w") as f:
            f.write(tpl % tex)
        # compile and convert to SVG
        cwd = os.getcwd()
        os.chdir(CACHE_DIR)
        subprocess.run(
            ["pdflatex", "-interaction=batchmode", f"{key}.tex"],
            stdout=subprocess.DEVNULL,
        )
        subprocess.run(
            ["dvisvgm", "--no-fonts", f"{key}.dvi"], stdout=subprocess.DEVNULL
        )
        os.chdir(cwd)
    # embed as base64
    raw = open(svg_path, "rb").read()
    b64 = base64.b64encode(raw).decode()
    return b64


def action(elem, doc):
    if isinstance(elem, Math):
        svg_b64 = latex_to_svg(
            elem.text
            if elem.mathtype == "InlineMath"
            else "\\displaystyle " + elem.text
        )
        cls = "inline-math" if elem.mathtype == "InlineMath" else "display-math"
        html = (
            f'<img src="data:image/svg+xml;base64,{svg_b64}" '
            f'alt="${elem.text}$" class="math {cls}"/>'
        )
        # inline vs block
        return (
            RawInline("html", html)
            if elem.mathtype == "InlineMath"
            else RawBlock("html", html)
        )


if __name__ == "__main__":
    run_filter(action)
