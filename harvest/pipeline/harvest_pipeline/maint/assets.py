"""Page images (and figure crops) as pack files: WebP sized for a tablet.

Default 1400 px wide at quality 82: 7 pt print stays legible (about 2.3 px per point on a letter
page). The same image is what a vision model reads, so the citation highlight and the model saw
the same pixels. Figure crops come from the figure region's box on the rendered page.
"""

from __future__ import annotations

import io
from pathlib import Path

from ..textutil import sha256_bytes
from .layout import PageModel, render_page

DEFAULT_PX = 1400
QUALITY = 82


def render_pages(data: bytes, source_sha: str, models: list[PageModel], out_dir: Path, px: int = DEFAULT_PX,
                 quality: int = QUALITY) -> None:
    """Render each page once into out_dir (reused when present) and set its image fields."""
    out_dir.mkdir(parents=True, exist_ok=True)
    for pm in models:
        name = f"{pm.source_id}-p{pm.index + 1:04d}-{px}.webp"
        path = out_dir / name
        if not path.exists():
            img = render_page(data, pm.index, px)
            buf = io.BytesIO()
            img.save(buf, "WEBP", quality=quality, method=6)
            path.write_bytes(buf.getvalue())
        from PIL import Image
        with Image.open(path) as im:
            pm.image_size = im.size
        pm.image = str(path)
        pm.image_id = f"{source_sha[:16]}:{pm.index}:{px}w"


def crop_figure(pm: PageModel, bbox, out: Path, quality: int = QUALITY) -> tuple[int, int]:
    from PIL import Image
    with Image.open(pm.image) as im:
        sx, sy = im.width / pm.width, im.height / pm.height
        pad = 4
        box = (max(0, int((bbox[0] - pad) * sx)), max(0, int((bbox[1] - pad) * sy)),
               min(im.width, int((bbox[2] + pad) * sx)), min(im.height, int((bbox[3] + pad) * sy)))
        crop = im.crop(box)
        out.parent.mkdir(parents=True, exist_ok=True)
        crop.save(out, "WEBP", quality=quality, method=6)
        return crop.size


def file_row(asset_id: str, rel_path: str, path: Path, size: tuple[int, int] | None) -> dict:
    data = path.read_bytes()
    return {"asset_id": asset_id, "path": rel_path, "sha256": sha256_bytes(data), "media_type": "image/webp",
            "bytes": len(data), "width": size[0] if size else None, "height": size[1] if size else None}
