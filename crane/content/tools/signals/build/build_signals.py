"""Build the standard hand-signal reference from the GPO CFR PDF of
Appendix A to Subpart CC of 29 CFR 1926.

    python build_signals.py <appA.pdf> [--work DIR] [--index sections.json]

Steps (deterministic, no network):

  1. Check the PDF's SHA-256 against the pinned edition (signals.src.yaml).
  2. Extract the two page images with `pdfimages -png` (lossless CCITT decode).
  3. Find the table grid: rows/columns whose ink covers >= 90 % of the page.
  4. In each non-empty cell, split figure from caption: caption lines sit on a
     regular line pitch; walk up from the last text line while the previous
     ink run is one pitch higher and no taller than a line.
  5. Figure: smooth the halftone grain (blur + threshold), drop components
     smaller than MIN_AREA px, crop tight, trace with potrace, rewrite as a
     small SVG filled with currentColor.
  6. Caption: OCR the crop with tesseract and compare to the transcription in
     signals.src.yaml; measure the printed dash. Any difference not covered
     exactly by a recorded ocr_resolution fails the build.
  7. Only when every check passes, write svg/, signals.json and build/VERIFY.md.
     A failed build leaves the committed outputs untouched.

Requires: Pillow, PyYAML, and the binaries pdfimages, potrace, tesseract.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

import yaml
from PIL import Image, ImageFilter

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
SRC = HERE / "signals.src.yaml"

GRID_FRAC = 0.90  # a grid line's ink covers this share of the page
INSET = 12  # px kept clear of each grid line (lines are 3-5 px)
BLUR = 1.5  # Gaussian radius that fills the halftone grain of the scan
THRESH = 128  # 0-255 cutoff after blur (ink is below)
MIN_AREA = 40  # components smaller than this (px) are scan specks
PAD = 6  # px of margin kept around the traced figure
POTRACE = ["-b", "svg", "--flat", "-t", "40", "-a", "1.0", "-O", "0.8", "-u", "1"]
EN_DASH = (0.6, 0.95)  # en dash width / cap height (hyphen ~0.45, em dash ~1.5)


# ---------------------------------------------------------------- image helpers


def ink_rows(im: Image.Image) -> list[int]:
    w, h = im.size
    b = im.tobytes()
    return [b[y * w:(y + 1) * w].count(0) for y in range(h)]


def ink_cols(im: Image.Image) -> list[int]:
    return ink_rows(im.transpose(Image.Transpose.TRANSPOSE))


def bands(profile: list[int], cutoff: float) -> list[tuple[int, int]]:
    """Inclusive (start, end) runs where profile > cutoff."""
    out, start = [], None
    for i, v in enumerate(profile + [0]):
        if v > cutoff:
            if start is None:
                start = i
        elif start is not None:
            out.append((start, i - 1))
            start = None
    return out


def grid(im: Image.Image):
    w, h = im.size
    rows = bands(ink_rows(im), GRID_FRAC * w)
    cols = bands(ink_cols(im), GRID_FRAC * h)
    return rows, cols


def components(im: Image.Image):
    """8-connected components of ink (0) via run-length union-find.

    Returns (runs, find) where runs is [(y, x0, x1, label)] and find maps a
    label to its root, plus per-root area and bbox."""
    w, h = im.size
    b = im.tobytes()
    parent: list[int] = []

    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]
            a = parent[a]
        return a

    runs = []
    prev: list[tuple[int, int, int]] = []
    pat = re.compile(rb"\x00+")
    for y in range(h):
        cur = []
        for m in pat.finditer(b, y * w, (y + 1) * w):
            x0, x1 = m.start() - y * w, m.end() - 1 - y * w
            lab = -1
            for px0, px1, pl in prev:
                if px0 <= x1 + 1 and px1 >= x0 - 1:
                    if lab < 0:
                        lab = find(pl)
                    else:
                        ra, rb_ = find(lab), find(pl)
                        if ra != rb_:
                            parent[max(ra, rb_)] = min(ra, rb_)
                            lab = min(ra, rb_)
            if lab < 0:
                lab = len(parent)
                parent.append(lab)
            cur.append((x0, x1, lab))
            runs.append((y, x0, x1, lab))
        prev = cur
    stats: dict[int, list] = {}
    for y, x0, x1, lab in runs:
        r = find(lab)
        s = stats.setdefault(r, [0, x0, y, x1, y])
        s[0] += x1 - x0 + 1
        s[1], s[2], s[3], s[4] = min(s[1], x0), min(s[2], y), max(s[3], x1), max(s[4], y)
    return runs, find, stats


def clean(fig: Image.Image) -> tuple[Image.Image, dict]:
    """Smooth grain, drop specks, crop tight. Returns a mode-'1' image."""
    sm = fig.filter(ImageFilter.GaussianBlur(BLUR)).point(lambda v: 0 if v < THRESH else 255)
    runs, find, stats = components(sm)
    keep = {r for r, s in stats.items() if s[0] >= MIN_AREA}
    out = Image.new("L", sm.size, 255)
    px = out.load()
    for y, x0, x1, lab in runs:
        if find(lab) in keep:
            for x in range(x0, x1 + 1):
                px[x, y] = 0
    dropped = sorted(s[0] for r, s in stats.items() if r not in keep)
    inv = out.point(lambda v: 255 - v)
    x0, y0, x1, y1 = inv.getbbox()
    w, h = out.size
    box = (max(0, x0 - PAD), max(0, y0 - PAD), min(w, x1 + PAD), min(h, y1 + PAD))
    info = {"components": len(keep), "specks_dropped": len(dropped), "largest_speck": dropped[-1] if dropped else 0}
    return out.crop(box).convert("1"), info


def last_pitch(cell: Image.Image) -> int:
    """Top-to-top distance of the cell's last two ink runs (two caption lines)."""
    runs = bands(ink_rows(cell), 0)
    return runs[-1][0] - runs[-2][0]


def split_caption(cell: Image.Image, pitch: int) -> int:
    """Return the y where the caption starts inside a cell crop.

    pitch is the table's caption line pitch (median over all cells)."""
    runs = bands(ink_rows(cell), 0)
    i = len(runs) - 1
    while i > 0:
        a, b = runs[i - 1]
        if abs((runs[i][0] - a) - pitch) <= 8 and (b - a) < pitch:
            i -= 1
        else:
            break
    return runs[i][0]


# ---------------------------------------------------------------- svg


def to_svg(bitmap: Image.Image, title: str, work: Path, sid: str) -> str:
    pbm = work / f"{sid}.pbm"
    raw = work / f"{sid}.potrace.svg"
    bitmap.save(pbm)
    subprocess.run(["potrace", *POTRACE, "-o", str(raw), str(pbm)], check=True)
    text = raw.read_text()
    paths = re.findall(r'<path d="([^"]+)"', text)
    m = re.search(r'<g transform="([^"]+)"', text)
    if not m:
        raise SystemExit(f"{sid}: unexpected potrace SVG output ({tool_version('potrace')})")
    tr = m.group(1)
    tr = re.sub(r"(\d)\.0+\b", r"\1", tr)  # "1.000000" -> "1"
    if len(paths) != 1:
        raise SystemExit(f"{sid}: expected one flat path, got {len(paths)}")
    d = re.sub(r"\s+", " ", paths[0]).strip()
    w, h = bitmap.size
    esc = title.replace("&", "&amp;").replace("<", "&lt;")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" '
        f'aria-labelledby="{sid}-title"><title id="{sid}-title">{esc}</title>'
        f'<path fill="currentColor" transform="{tr}" d="{d}"/></svg>\n'
    )


# ---------------------------------------------------------------- ocr


def norm_text(s: str) -> str:
    s = unicodedata.normalize("NFKC", s)
    s = re.sub(r"[‐-―−]", "-", s)
    s = s.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", s).strip()


def levenshtein(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def dash_ratio(cap: Image.Image) -> float:
    """Width of the caption's first dash glyph over the height of its first capital.

    The dash is the first wide, flat component in reading order (names carry
    no hyphens). Distinguishes hyphen, en dash and em dash in the print."""
    lines = bands(ink_rows(cap), 0)
    _, _, first = components(cap.crop((0, lines[0][0], cap.width, lines[0][1] + 1)))
    glyphs = sorted((s[1], s[4] - s[2] + 1) for s in first.values() if s[4] - s[2] >= 20)
    cap_h = glyphs[0][1]  # every name starts with a capital letter
    for y0, y1 in lines:
        _, _, stats = components(cap.crop((0, y0, cap.width, y1 + 1)))
        flat = sorted((s[1], s[3] - s[1] + 1) for s in stats.values()
                      if (s[3] - s[1] + 1) >= 20 and (s[3] - s[1] + 1) >= 4 * (s[4] - s[2] + 1))
        if flat:
            return flat[0][1] / cap_h
    raise SystemExit("no dash found in caption")


def tool_version(name: str) -> str:
    r = subprocess.run([name, "--version"], capture_output=True, text=True)
    return (r.stdout or r.stderr).splitlines()[0].split(". Copyright")[0]


def resolved(got: str, caption: str, res) -> bool:
    """True when the recorded OCR misreads turn the OCR text into the caption."""
    if not res:
        return False
    text = norm_text(got)
    for wrong, right in res["replace"]:
        if norm_text(wrong) not in text:
            return False
        text = text.replace(norm_text(wrong), norm_text(right))
    return text == norm_text(caption)


def ocr(img: Image.Image, work: Path, sid: str) -> str:
    p = work / f"{sid}.caption.png"
    img.save(p, dpi=(772, 772))
    r = subprocess.run(["tesseract", str(p), "-", "--psm", "6", "-l", "eng"], check=True, capture_output=True, text=True)
    return r.stdout


# ---------------------------------------------------------------- main


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("pdf")
    ap.add_argument("--work", help="keep intermediate crops here (default: temp dir)")
    ap.add_argument("--index", help="eCFR sections.json; checks every related_section_id exists")
    a = ap.parse_args()

    src = yaml.safe_load(SRC.read_text())
    source = src["source"]
    pdf = Path(a.pdf)
    sha = hashlib.sha256(pdf.read_bytes()).hexdigest()
    if sha != source["sha256"]:
        raise SystemExit(f"{pdf}: sha256 {sha} is not the pinned edition {source['sha256']}")

    work = Path(a.work) if a.work else Path(tempfile.mkdtemp(prefix="signals-"))
    work.mkdir(parents=True, exist_ok=True)
    try:
        build(a, src, source, pdf, sha, work)
    except BaseException:
        print(f"build failed; intermediate crops kept in {work}", file=sys.stderr)
        raise
    if not a.work:
        shutil.rmtree(work)


def build(a, src, source, pdf, sha, work):
    for f in work.glob("page-*.png"):
        f.unlink()
    subprocess.run(["pdfimages", "-png", str(pdf), str(work / "page")], check=True)
    pages = sorted(work.glob("page-*.png"))
    if len(pages) != len(source["pages"]):
        raise SystemExit(f"expected {len(source['pages'])} page images, got {len(pages)}")

    cells = []  # (page_index, row, col, cell image)
    for pi, pth in enumerate(pages):
        im = Image.open(pth).convert("L")
        rows, cols = grid(im)
        for r in range(len(rows) - 1):
            for c in range(len(cols) - 1):
                box = (cols[c][1] + INSET, rows[r][1] + INSET, cols[c + 1][0] - INSET, rows[r + 1][0] - INSET)
                cell = im.crop(box)
                if cell.point(lambda v: 255 - v).getbbox() is None:
                    continue
                cells.append((pi, r, c, cell))

    signals = src["signals"]
    if len(cells) != len(signals):
        raise SystemExit(f"found {len(cells)} signal cells, signals.src.yaml lists {len(signals)}")

    pitches = sorted(last_pitch(cell) for *_, cell in cells)
    pitch = pitches[len(pitches) // 2]

    out, verify, svgs = [], [], {}
    for (pi, r, c, cell), sg in zip(cells, signals):
        sid = sg["signal_id"]
        cap_y = split_caption(cell, pitch)
        fig, info = clean(cell.crop((0, 0, cell.width, cap_y - 1)))
        fig.convert("L").save(work / f"{sid}.figure.png")
        svg = to_svg(fig, f"{sg['name']} (standard hand signal)", work, sid)
        svgs[sid] = svg
        caption = f"{sg['name']} {source['dash']} {sg['description']}"
        cap_img = cell.crop((0, cap_y - 8, cell.width, cell.height))
        got = ocr(cap_img, work, sid)
        dist = levenshtein(norm_text(got), norm_text(caption))
        ratio = dist / max(len(norm_text(caption)), 1)
        dr = dash_ratio(cap_img)
        if source["dash"] == "\u2013" and not EN_DASH[0] <= dr <= EN_DASH[1]:
            raise SystemExit(f"{sid}: printed dash is {dr:.2f} cap heights wide, not an en dash")
        res = sg.get("ocr_resolution")
        status = "agrees" if dist == 0 else "resolved" if resolved(got, caption, res) else "UNRESOLVED"
        verify.append((sid, norm_text(got), caption, dist, ratio, dr, status, res))
        page = source["pages"][pi]
        out.append({
            "signal_id": sid,
            "name": sg["name"],
            "description": sg["description"],
            "caption": caption,
            "svg": {"path": f"svg/{sid}.svg", "width": fig.width, "height": fig.height,
                    "bytes": len(svg.encode())},
            "kind": sg["kind"],
            "motion": sg["motion"],
            "crane_types": sg["crane_types"],
            "modifiers": sg.get("modifiers", []),
            "section_id": "29cfr1926.cc.appA",
            "related_section_ids": sg["related_section_ids"],
            "teaching_tip": {"text": sg["tip"], "verbatim": False},
            "source": {"url": source["url"], "edition": source["edition"], "sha256": sha,
                       "page": page["pdf_page"], "printed_page": page["printed_page"],
                       "graphic": page["graphic"], "cell": {"row": r + 1, "col": c + 1}},
        })
        print(f"{sid:28s} p{pi + 1} r{r + 1}c{c + 1} fig {fig.width}x{fig.height} "
              f"svg {len(svg.encode()):6d} B specks-dropped {info['specks_dropped']}")

    ids = [s["signal_id"] for s in out]
    for s in out:
        for m in s["modifiers"]:
            if m not in ids:
                raise SystemExit(f"{s['signal_id']}: unknown modifier {m}")
    if a.index:
        known = json.loads(Path(a.index).read_text())["sections"]
        for s in out:
            for rid in s["related_section_ids"]:
                if rid not in known:
                    raise SystemExit(f"{s['signal_id']}: unknown related_section_id {rid}")

    doc = {
        "$schema": "./signals.schema.json",
        "title": src["title"],
        "section_id": "29cfr1926.cc.appA",
        "source": {"url": source["url"], "edition": source["edition"], "sha256": sha,
                   "license": source["license"]},
        "notes": src["notes"],
        "signals": out,
    }
    report = verify_report(verify)
    bad = [sid for sid, *_, status, _ in verify if status == "UNRESOLVED"]
    if bad:
        (work / "VERIFY.md").write_text(report)
        raise SystemExit(f"unresolved OCR disagreements: {', '.join(bad)} (see {work / 'VERIFY.md'})")

    svg_dir = OUT / "svg"
    svg_dir.mkdir(exist_ok=True)
    for sid, svg in svgs.items():
        (svg_dir / f"{sid}.svg").write_text(svg)
    (OUT / "signals.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    (HERE / "VERIFY.md").write_text(report)


def verify_report(rows) -> str:
    tver = tool_version("tesseract")
    lines = [
        "# Caption verification",
        "",
        "Generated by `build_signals.py`. Each caption crop is OCR'd with",
        f"`{tver}` (`--psm 6 -l eng`) and compared with the transcription in",
        "`signals.src.yaml` after normalizing whitespace, dashes and quotes.",
        "Distance is Levenshtein; ratio is distance / transcription length.",
        "Only distance 0 counts as agreement. Every other case was checked against the",
        "full-resolution caption crop and recorded as exact OCR-to-print replacements;",
        "it counts as resolved only if those replacements turn the OCR text into the",
        "transcription. Anything else fails the build.",
        f"Figures traced with `{tool_version('potrace')}`.",
        "",
        "OCR cannot tell a hyphen from an en or em dash, so the dash after each name is",
        "measured in pixels: its width over the height of the caption's first capital letter.",
        f"An en dash (half an em) measures about 0.75; the build fails outside {EN_DASH[0]}-{EN_DASH[1]}.",
        "",
    ]
    for sid, got, cap, dist, ratio, dr, status, res in rows:
        if res:
            fixes = "; ".join(f"`{w}` -> `{r}`" for w, r in res["replace"])
            note = f"{res['note']} Replacements: {fixes}."
        else:
            note = "After normalization, OCR matches the transcription exactly."
        lines += [
            f"## {sid}",
            "",
            f"- OCR: `{got}`",
            f"- Transcription: `{cap}`",
            f"- Distance: {dist} (ratio {ratio:.3f}), {status}",
            f"- Dash: {dr:.2f} cap heights wide (en dash)",
            f"- Resolution: {note}",
            "",
        ]
    return "\n".join(lines)


if __name__ == "__main__":
    sys.exit(main())
