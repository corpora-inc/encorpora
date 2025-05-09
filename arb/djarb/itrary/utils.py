from pathlib import Path
from typing import Union
from typing import Optional
from pydantic import BaseModel
import yaml


class BookConfig(BaseModel):
    title: str
    subtitle: str
    author: Optional[str] = "The Encorpora Team"
    publisher: Optional[str] = "Corpora Inc"
    units: Optional[int] = 8
    lessons_per_unit: Optional[int] = 6
    max_images_per_lesson: Optional[int] = 2
    exercises_per_lesson: Optional[int] = 3
    isbn: Optional[str] = ""
    image_instructions: Optional[str] = None
    llm_instructions: Optional[str] = None


def load_book_config(config_path: str) -> BookConfig:
    """
    Load book configuration from the specified config.yaml path.

    Args:
        config_path: Path to config YAML (e.g., 'book-input/georgia-state-history/config.yaml').

    Returns:
        BookConfig: Validated configuration object.
    """
    try:
        with open(config_path, "r") as f:
            config_data = yaml.safe_load(f)
        return BookConfig(**config_data)
    except (yaml.YAMLError, TypeError) as e:
        raise ValueError(f"Error parsing {config_path}: {e}")


def dump_book_config(config: BookConfig) -> str:
    """
    Pretty-print a BookConfig instance as a YAML string with nice spacing.

    Args:
        config: BookConfig instance to serialize.

    Returns:
        str: Formatted YAML string.
    """
    config_dict = config.model_dump(exclude_none=True)
    return yaml.dump(
        config_dict,
        default_flow_style=False,
        indent=2,
        sort_keys=False,
        allow_unicode=True,
    )


def save_image(data: bytes, out_path: Union[str, Path]) -> Path:
    """
    Write raw image bytes to disk.

    Args:
        data: The image's binary content.
        out_path: Filepath where to save (including extension).

    Returns:
        Path: The Path to the written file.
    """
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path
