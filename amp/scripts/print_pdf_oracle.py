"""Check exported print artifacts independently with Poppler's PDF text boxes.

Run after `npm run publications`. The standard math review also runs this check
when an export directory exists; CI exports the corpus before that review.
The bounds detect misplaced/clipped text, not overall visual quality.
"""
from hashlib import sha256
from pathlib import Path
import json
import math
import re
import subprocess
import xml.etree.ElementTree as ET


def require(condition, message):
    if not condition:
        raise ValueError(message)


def check_page_bounds(xml, filename):
    tree = ET.fromstring(xml)
    pages = tree.findall('.//{*}page')
    require(pages, f'No PDF pages: {filename}')
    margin = 18 / 25.4 * 72
    # Font metric boxes include small overhangs beyond the visible glyph.
    tolerance = 3
    expected_width, expected_height = ((612, 792) if filename.endswith('-Letter.pdf')
                                       else (210 / 25.4 * 72, 297 / 25.4 * 72))
    for index, page in enumerate(pages, 1):
        width, height = float(page.attrib['width']), float(page.attrib['height'])
        require(math.isfinite(width) and math.isfinite(height)
                and abs(width - expected_width) < 1 and abs(height - expected_height) < 1,
                f'Unexpected paper dimensions: {filename}, page {index}')
        words = page.findall('.//{*}word')
        require(words, f'Empty printed page: {filename}, page {index}')
        for word in words:
            left, top, right, bottom = [float(word.attrib[key])
                                        for key in ('xMin', 'yMin', 'xMax', 'yMax')]
            require(all(math.isfinite(v) for v in (left, top, right, bottom))
                    and left <= right and top <= bottom,
                    f'Invalid text bounds: {filename}, page {index}')
            require(left >= margin - tolerance and top >= margin - tolerance
                    and right <= width - margin + tolerance
                    and bottom <= height - margin + tolerance,
                    f'Text crosses print margin: {filename}, page {index}, {word.text!r}, '
                    f'box=({left}, {top}, {right}, {bottom})')
    return len(pages)


def self_test():
    valid = '<doc><page width="612" height="792"><word xMin="60" yMin="60" xMax="70" yMax="72">4</word></page></doc>'
    require(check_page_bounds(valid, 'fixture-Letter.pdf') == 1, 'PDF reference fixture failed')
    mutations = [valid.replace('yMin="60"', 'yMin="40"'),
                 valid.replace('yMax="72"', 'yMax="754"'),
                 valid.replace('xMax="70"', 'xMax="600"'),
                 valid.replace('width="612"', 'width="800"'),
                 valid.replace('xMin="60"', 'xMin="nan"'),
                 '<doc><page width="612" height="792"/></doc>', '<doc/>']
    for mutated in mutations:
        try:
            check_page_bounds(mutated, 'fixture-Letter.pdf')
        except ValueError:
            continue
        raise ValueError('PDF oracle accepted a malformed or overflowing fixture')
    return len(mutations)


def review_print_pdfs(directory):
    rejected = self_test()
    directory = Path(directory)
    manifest = json.loads((directory / 'manifest.json').read_text())
    entries = manifest['publications']
    require(isinstance(entries, list) and entries, 'Missing publication inventory')
    names = [entry['filename'] for entry in entries]
    require(len(set(names)) == len(names), 'Duplicate publication filename')
    require(all(isinstance(name, str) and re.fullmatch(
        r'[a-z0-9-]+-(?:lesson|workbook|solutions)-(?:Letter|A4)\.pdf', name)
        for name in names), 'Invalid publication filename')
    require(set(names) == {path.name for path in directory.glob('*.pdf')},
            'PDF files do not match the publication inventory')
    pages = 0
    for entry in entries:
        filename = entry['filename']
        path = directory / filename
        data = path.read_bytes()
        require(data.startswith(b'%PDF-') and len(data) == entry['bytes']
                and sha256(data).hexdigest() == entry['sha256'],
                f'Publication bytes differ from manifest: {filename}')
        result = subprocess.run(['pdftotext', '-bbox', str(path), '-'],
                                capture_output=True, text=True, timeout=30)
        require(result.returncode == 0, f'PDF text inspection failed: {filename}')
        pages += check_page_bounds(result.stdout, filename)
    return {'pdfs': len(entries), 'pages': pages, 'rejectedMutations': rejected}


if __name__ == '__main__':
    import sys
    directory = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent.parent / 'artifacts/publications'
    print(json.dumps(review_print_pdfs(directory)))
