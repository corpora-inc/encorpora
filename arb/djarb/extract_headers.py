#!/usr/bin/env python3
import argparse
from pathlib import Path
import re
from typing import List, Tuple


def extract_headers(text: str) -> List[Tuple[int, str]]:
    """
    Find Markdown headers of level 1–3 and return a list of (level, title).
    """
    pattern = re.compile(r"^(#{1,2})\s+(.*)", re.MULTILINE)
    return [(len(m.group(1)), m.group(2).strip()) for m in pattern.finditer(text)]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extract up to level‑3 headers from a Markdown file."
    )
    parser.add_argument("markdown_file", type=Path, help="Path to the .md file")
    args = parser.parse_args()

    content = args.markdown_file.read_text(encoding="utf-8")
    headers = extract_headers(content)

    for level, title in headers:
        indent = "  " * (level - 1)
        print(f"{indent}- {title}")


if __name__ == "__main__":
    main()
