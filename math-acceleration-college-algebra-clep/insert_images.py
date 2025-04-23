import os
import re
import subprocess
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
import matplotlib.pyplot as plt
import numpy as np
import sympy as sp
from pydantic import BaseModel

LLM_PROVIVDER = "openai"


SKIP_FILES = []

ONLY_FILES = [
    # "01-08-lesson-real-number-classifications-and-properties-rational-irrational.md",
    # "03-06-lesson-domain-and-range-of-functions.md",
    # "03-07-lesson-algebra-of-functions-sums-products-and-quotients.md",
    # "05-06-lesson-solving-and-graphing-quadratic-inequalities.md",
    # "10-06-lesson-factorials-and-binomial-theorem.md",
    # "07-02-lesson-graphing-rational-functions-and-understanding-asymptotes.md",
    # $ grep -r tikzpic *.md
    # 01-08-lesson-real-number-classifications-and-properties-rational-irrational.md:\begin{tikzpicture}[x=0.5cm]
    # 01-08-lesson-real-number-classifications-and-properties-rational-irrational.md:\end{tikzpicture}
    # 02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md:\begin{tikzpicture}[x=0.5cm]
    # 02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md:\end{tikzpicture}
    # 02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md:\begin{tikzpicture}[x=0.5cm]
    # 02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md:\end{tikzpicture}
    # 03-02-lesson-graphing-linear-functions-and-understanding-slope.md:\begin{tikzpicture}
    # 03-02-lesson-graphing-linear-functions-and-understanding-slope.md:\end{tikzpicture}
    # 03-02-lesson-graphing-linear-functions-and-understanding-slope.md:\begin{tikzpicture}
    # 03-02-lesson-graphing-linear-functions-and-understanding-slope.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\begin{tikzpicture}
    # 03-03-lesson-function-transformations-and-shifts.md:\end{tikzpicture}
    # 03-04-lesson-graphing-and-analyzing-quadratic-functions.md:\begin{tikzpicture}[scale=0.8]
    # 03-04-lesson-graphing-and-analyzing-quadratic-functions.md:\end{tikzpicture}
    # 03-04-lesson-graphing-and-analyzing-quadratic-functions.md:\begin{tikzpicture}[scale=0.8]
    # 03-04-lesson-graphing-and-analyzing-quadratic-functions.md:\end{tikzpicture}
    # 05-06-lesson-solving-and-graphing-quadratic-inequalities.md:\begin{tikzpicture}[x=0.6cm]
    # 05-06-lesson-solving-and-graphing-quadratic-inequalities.md:\end{tikzpicture}
    # 06-01-lesson-defining-exponential-functions-and-their-properties.md:\begin{tikzpicture}[x=0.8cm, y=0.5cm]
    # 06-01-lesson-defining-exponential-functions-and-their-properties.md:\end{tikzpicture}
    # 06-02-lesson-graphing-exponential-functions-and-real-world-applications.md:\begin{tikzpicture}
    # 06-02-lesson-graphing-exponential-functions-and-real-world-applications.md:\end{tikzpicture}
    # 06-02-lesson-graphing-exponential-functions-and-real-world-applications.md:\begin{tikzpicture}
    # 06-02-lesson-graphing-exponential-functions-and-real-world-applications.md:\end{tikzpicture}
    # 08-02-lesson-representing-complex-numbers-on-the-complex-plane.md:\begin{tikzpicture}[scale=0.6]
    # 08-02-lesson-representing-complex-numbers-on-the-complex-plane.md:\end{tikzpicture}
    # 08-05-lesson-applications-of-conic-sections-in-science-and-engineering.md:\begin{tikzpicture}[scale=0.8]
    # 08-05-lesson-applications-of-conic-sections-in-science-and-engineering.md:\end{tikzpicture}
    # 08-05-lesson-applications-of-conic-sections-in-science-and-engineering.md:\begin{tikzpicture}
    # 08-05-lesson-applications-of-conic-sections-in-science-and-engineering.md:\end{tikzpicture}
    # 09-03-lesson-graphical-interpretation-of-systems-of-equations.md:\begin{tikzpicture}[scale=0.8]
    # 09-03-lesson-graphical-interpretation-of-systems-of-equations.md:\end{tikzpicture}
    # 10-01-lesson-arithmetic-and-geometric-sequences.md:\begin{tikzpicture}[x=0.6cm]
    # 10-01-lesson-arithmetic-and-geometric-sequences.md:\end{tikzpicture}
    # 10-04-lesson-exploring-recursive-sequences-and-formula-derivation.md:\begin{tikzpicture}[x=0.7cm, y=0.5cm]
    # 10-04-lesson-exploring-recursive-sequences-and-formula-derivation.md:\end{tikzpicture}
    # 11-01-lesson-constructing-functions-to-model-real-world-scenarios.md:\begin{tikzpicture}[x=0.5cm]
    # 11-01-lesson-constructing-functions-to-model-real-world-scenarios.md:\end{tikzpicture}
    # 11-02-lesson-interpreting-and-analyzing-graphical-data.md:\begin{tikzpicture}
    # 11-02-lesson-interpreting-and-analyzing-graphical-data.md:\end{tikzpicture}
    #
    # "01-08-lesson-real-number-classifications-and-properties-rational-irrational.md",
    # "02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md",
    # "03-02-lesson-graphing-linear-functions-and-understanding-slope.md",
    # "03-03-lesson-function-transformations-and-shifts.md",
    # "03-04-lesson-graphing-and-analyzing-quadratic-functions.md",
    "05-06-lesson-solving-and-graphing-quadratic-inequalities.md",
    "06-01-lesson-defining-exponential-functions-and-their-properties.md",
    "06-02-lesson-graphing-exponential-functions-and-real-world-applications.md",
    "08-02-lesson-representing-complex-numbers-on-the-complex-plane.md",
    "08-05-lesson-applications-of-conic-sections-in-science-and-engineering.md",
    "09-03-lesson-graphical-interpretation-of-systems-of-equations.md",
    "10-01-lesson-arithmetic-and-geometric-sequences.md",
    "10-04-lesson-exploring-recursive-sequences-and-formula-derivation.md",
    "11-01-lesson-constructing-functions-to-model-real-world-scenarios.md",
    "11-02-lesson-interpreting-and-analyzing-graphical-data.md",
]

PLOT_SYSTEM_MESSAGE = (
    "Analyze the provided markdown content to identify 0-7 key mathematical concepts that would benefit from a visual plot. "
    # "If there are already figures or plots, do not add more. Return an empty list. "
    "If there is a tikzpicture, insert an image after the final \\vspace after the tikzpicture. "
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
    "If no plots are needed, return an empty list. Do not make redundant plots. "
    "Return only the JSON list, no explanations."
)

FIX_BUILD_SYSTEM_MESSAGE = (
    "Analyze the provided original markdown content, updated markdown content with inserted images, and the build error output from './build.sh'. "
    "Generate a corrected version of the updated markdown content to fix the build error. "
    "Ensure the corrected content: "
    "- Retains all valid image insertions unless they cause the error. "
    "- Maintains the original markdown structure and content as much as possible. "
    "- Addresses the specific build error (e.g., invalid markdown syntax, image path issues). "
    "Return a JSON object with: "
    "- 'corrected_content': the corrected markdown content (string). "
    "Return only the JSON object, no explanations."
)


class PlotSchema(BaseModel):
    code: str
    description: str
    insert_after: str


class PlotsSchema(BaseModel):
    plots: list[PlotSchema]


class FixBuildSchema(BaseModel):
    corrected_content: str


def generate_plots(content: str, corpus_id: str) -> PlotsSchema:
    print(f"Generating plots for corpus_id: {corpus_id}")
    llm = load_llm_provider(LLM_PROVIVDER)
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
    plots = llm.get_data_completion(messages, PlotsSchema)
    print(f"Generated {len(plots.plots)} plots")
    return plots


def fix_build_error(
    original_content: str, updated_content: str, error_output: str, corpus_id: str
) -> str:
    print(f"Fixing build error for corpus_id: {corpus_id}")
    llm = load_llm_provider(LLM_PROVIVDER)
    messages = [
        ChatCompletionTextMessage(
            role="system",
            text=FIX_BUILD_SYSTEM_MESSAGE,
        ),
        ChatCompletionTextMessage(
            role="user",
            text=f"Original content:\n{original_content}\n\nUpdated content:\n{updated_content}\n\nBuild error:\n{error_output}",
        ),
    ]
    result = llm.get_data_completion(messages, FixBuildSchema)
    print("Generated corrected content")
    return result.corrected_content


def insert_image_markdown(content: str, plot: PlotSchema, image_path: str) -> str:
    print(f"Inserting image: {image_path} after pattern: {plot.insert_after}")
    pattern = re.compile(plot.insert_after)
    lines = content.splitlines()
    inserted = False
    for i, line in enumerate(lines):
        if pattern.search(line):
            lines.insert(i + 1, f"\n\n![{plot.description}]({image_path})\n\n")
            print(f"Inserted at line {i + 1}: ![{plot.description}]({image_path})")
            inserted = True
            break
    if not inserted:
        print(f"Warning: No match for pattern {plot.insert_after}, appending image")
        lines.append(f"\n\n![{plot.description}]({image_path})\n\n")
    return "\n".join(lines)


def run_build_script(markdown_dir: str) -> tuple[bool, str]:
    print("Running ./build.sh")
    try:
        result = subprocess.run(
            ["/bin/bash", "./build.sh"],
            cwd=markdown_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        print("Build succeeded")
        return True, result.stdout
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e.stderr}")
        return False, e.stderr
    except OSError as e:
        print(f"Build script execution error: {str(e)}")
        return False, str(e)


def process_markdown_file(
    file_path: str, corpus_id: str, output_dir: str, markdown_dir: str
):
    print(f"Processing file: {file_path}")
    with open(file_path, "r", encoding="utf-8") as f:
        original_content = f.read()

    plots = generate_plots(original_content, corpus_id)
    if not plots.plots:
        print(f"No plots needed for {file_path}")
        return

    updated_content = original_content
    image_paths = []
    for i, plot in enumerate(plots.plots, 1):
        pycode = plot.code
        expected_image_name = f"plot_{i}.png"
        image_path = os.path.join(
            output_dir, f"plot_{i}_{os.path.basename(file_path)}.png"
        )
        print(
            f"Executing plot code, expecting: {expected_image_name}, saving to: {image_path}"
        )
        exec(pycode, {"np": np, "plt": plt, "sp": sp})

        if os.path.exists(expected_image_name):
            print(f"Found {expected_image_name}, moving to {image_path}")
            os.makedirs(os.path.dirname(image_path), exist_ok=True)
            os.rename(expected_image_name, image_path)
            relative_image_path = os.path.relpath(
                image_path, os.path.dirname(file_path)
            )
            updated_content = insert_image_markdown(
                updated_content, plot, relative_image_path
            )
            print(f"Updated content with image: {relative_image_path}")
            image_paths.append(image_path)
        else:
            print(f"Error: {expected_image_name} not found")
            continue

    max_retries = 2
    attempts = 0
    current_content = updated_content
    while attempts <= max_retries:
        print(
            f"Attempt {attempts + 1}/{max_retries + 1}: Writing content to {file_path}"
        )
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(current_content)

        success, error_output = run_build_script(markdown_dir)
        if success:
            print(f"Build succeeded for {file_path}")
            break

        print(f"Build failed for {file_path}, retrying with LLM correction")
        current_content = fix_build_error(
            original_content, current_content, error_output, corpus_id
        )
        attempts += 1

    if attempts > max_retries:
        print(f"Error: Max retries reached for {file_path}, restoring original content")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(original_content)
        for image_path in image_paths:
            if os.path.exists(image_path):
                print(f"Removing failed image: {image_path}")
                os.remove(image_path)


def main():
    corpus_id = "college-algebra-clep"
    markdown_dir = (
        "/workspace/test-corpora/books/math-acceleration-college-algebra-clep"
    )
    output_dir = os.path.join(markdown_dir, "images")
    os.makedirs(output_dir, exist_ok=True)
    print(f"Starting processing in {markdown_dir}, output dir: {output_dir}")

    files_to_process = ONLY_FILES if ONLY_FILES else sorted(os.listdir(markdown_dir))

    for file_name in files_to_process:
        print(f"\n\nProcessing file: {file_name}")
        if file_name in SKIP_FILES:
            print(f"Skipping {file_name}")
            continue

        if file_name.endswith(".md"):
            file_path = os.path.join(markdown_dir, file_name)
            process_markdown_file(file_path, corpus_id, output_dir, markdown_dir)
            print(f"Finished processing {file_name}\n\n")


if __name__ == "__main__":
    main()
