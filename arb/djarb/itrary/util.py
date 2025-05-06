from pathlib import Path
from typing import Union


def save_image(data: bytes, out_path: Union[str, Path]) -> Path:
    """
    Write raw image bytes to disk.

    Args:
      data: The image’s binary content.
      out_path: Filepath where to save (including extension).

    Returns:
      The Path to the written file.
    """
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path
