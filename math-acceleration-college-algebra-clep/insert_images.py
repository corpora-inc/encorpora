import os
import re
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
import matplotlib.pyplot as plt
import numpy as np
import sympy as sp

from pydantic import BaseModel

PLOT_SYSTEM_MESSAGE = (
    "Analyze the provided markdown content to identify 0-3 key mathematical concepts that would benefit from a visual plot. "
    "For each concept, generate a concise Python code snippet that: "
    "- Uses np for NumPy, plt for Matplotlib, sp for SymPy (already imported). "
    "- Creates a high-quality plot (e.g., 2D line, 3D surface, histogram) with labels, title, and grid. "
    "- Saves the plot to 'plot_{i}.png' (replace {i} with 1, 2, or 3). "
    "- Closes the figure with plt.close(). "
    "- Does NOT include import statements. "
    "Return a JSON list of objects, each with: "
    "- 'code': the Python code snippet (string). "
    "- 'description': a brief description of the plot (string). "
    "- 'insert_after': a regex pattern to match the markdown line after which to insert the image (string). "
    "If no plots are needed, return an empty list. "
    "Return only the JSON list, no explanations."
)


class PlotSchema(BaseModel):
    code: str
    description: str
    insert_after: str


class PlotsSchema(BaseModel):
    plots: list[PlotSchema]


def generate_plots(content: str, corpus_id: str) -> PlotsSchema:
    llm = load_llm_provider()
    messages = [
        ChatCompletionTextMessage(
            role="system",
            text=PLOT_SYSTEM_MESSAGE,
        ),
        ChatCompletionTextMessage(
            role="user",
            text=content,
        ),
    ]
    return llm.get_data_completion(messages, PlotsSchema)


def insert_image_markdown(content: str, plot: dict, image_path: str) -> str:
    pattern = re.compile(plot["insert_after"])
    lines = content.splitlines()
    for i, line in enumerate(lines):
        if pattern.search(line):
            lines.insert(i + 1, f"![{plot['description']}]({image_path})")
            break
    return "\n".join(lines)


def process_markdown_file(file_path: str, corpus_id: str, output_dir: str):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    plots: PlotsSchema = generate_plots(content, corpus_id)
    if not plots:
        print(f"No plots needed for {file_path}.")
        return

    updated_content = content
    for i, plot in enumerate(plots.plots, 1):
        pycode = plot.code
        image_path = os.path.join(
            output_dir, f"plot_{i}_{os.path.basename(file_path)}.png"
        )
        exec(pycode, {"np": np, "plt": plt, "sp": sp})

        if not os.path.exists(image_path):
            # this is always where we go - we have plot_1.png, plot_2.png, etc.
            continue

        # with open(image_path, "rb") as f:
        #     png_bytes = f.read()
        relative_image_path = os.path.relpath(image_path, os.path.dirname(file_path))
        updated_content = insert_image_markdown(
            updated_content, plot, relative_image_path
        )
        os.remove(image_path)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(updated_content)


def main():
    corpus_id = "ca-clep-100"  # Replace with your corpus ID
    markdown_dir = (
        "/workspace/test-corpora/books/math-acceleration-college-algebra-clep"
    )
    output_dir = os.path.join(markdown_dir, "images")
    os.makedirs(output_dir, exist_ok=True)

    for file_name in os.listdir(markdown_dir):
        if file_name.endswith(".md"):
            print(f"Processing {file_name}...")
            file_path = os.path.join(markdown_dir, file_name)
            process_markdown_file(file_path, corpus_id, output_dir)


if __name__ == "__main__":
    main()
