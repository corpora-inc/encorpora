import os
import re
import subprocess
from corpora_ai.llm_interface import ChatCompletionTextMessage
from corpora_ai.provider_loader import load_llm_provider
import matplotlib.pyplot as plt
import numpy as np
import sympy as sp
from pydantic import BaseModel

SKIP_FILES = [
    # "01-00-unit-intro-foundational-algebraic-concepts.md",
    # "01-01-lesson-understanding-variables-and-algebraic-expressions.md",
    # "01-02-lesson-operations-on-numbers-and-algebraic-terms.md",
    # "01-03-lesson-simplifying-expressions-and-combining-like-terms.md",
    # "01-04-lesson-the-distributive-property-and-its-applications.md",
    # "01-05-lesson-evaluating-algebraic-expressions.md",
    # "01-06-lesson-solving-basic-linear-equations.md",
    # "01-07-lesson-solving-equations-with-variables-on-both-sides.md",
    # "02-00-unit-intro-linear-equations-and-inequalities.md",
    # "02-01-lesson-solving-linear-equations-with-single-variable.md",
    # "02-02-lesson-solving-linear-inequalities-and-graphing-solution-sets.md",
    # "02-03-lesson-solving-equations-with-absolute-value.md",
    # "02-04-lesson-solving-inequalities-with-absolute-values.md",
    # "02-05-lesson-applications-of-linear-equations-in-real-life.md",
    # "03-00-unit-intro-functions-and-graphing.md",
    # "03-01-lesson-defining-functions-and-function-notation.md",
    # "03-02-lesson-graphing-linear-functions-and-understanding-slope.md",
    # "03-03-lesson-function-transformations-and-shifts.md",
    # "03-04-lesson-graphing-and-analyzing-quadratic-functions.md",
    # "03-05-lesson-inverse-functions-and-composite-functions.md",
    # "04-00-unit-intro-polynomial-functions-and-operations.md",
    # "04-01-lesson-adding-and-subtracting-polynomials.md",
    # "04-02-lesson-multiplying-polynomials-and-special-products.md",
    # "04-03-lesson-factoring-polynomials-and-common-factors.md",
    # "04-04-lesson-polynomial-division-and-synthetic-division.md",
    # "04-05-lesson-solving-polynomial-equations-using-the-zero-product-property.md",
    # "05-00-unit-intro-quadratic-functions-and-equations.md",
    # "05-01-lesson-solving-quadratic-equations-by-factoring.md",
    # "05-02-lesson-solving-quadratic-equations-using-the-quadratic-formula.md",
    # "05-03-lesson-completing-the-square-technique.md",
    # "05-04-lesson-graphing-quadratic-functions-using-vertex-form.md",
    # "05-05-lesson-analyzing-the-discriminant-and-nature-of-roots.md",
    # "06-00-unit-intro-exponential-and-logarithmic-functions.md",
    # "06-01-lesson-defining-exponential-functions-and-their-properties.md",
    # "06-02-lesson-graphing-exponential-functions-and-real-world-applications.md",
    # "06-03-lesson-introduction-to-logarithms-and-their-properties.md",
    # "06-04-lesson-solving-exponential-equations-using-logarithms.md",
    # "06-05-lesson-solving-logarithmic-equations-and-applications.md",
    # "07-00-unit-intro-rational-and-radical-functions.md",
    # "07-01-lesson-simplifying-rational-expressions-and-identifying-domain-restrictions.md",
    # "07-02-lesson-graphing-rational-functions-and-understanding-asymptotes.md",
    # "07-03-lesson-understanding-radical-functions-and-nth-roots.md",
    # "07-04-lesson-solving-equations-involving-radicals.md",
    # "07-05-lesson-real-world-applications-of-rational-and-radical-functions.md",
    # "08-00-unit-intro-complex-numbers-and-conic-sections.md",
    # "08-01-lesson-understanding-complex-numbers-and-basic-operations.md",
    # "08-02-lesson-representing-complex-numbers-on-the-complex-plane.md",
    # "08-03-lesson-introduction-to-conic-sections-and-standard-equations.md",
]

ONLY_FILES = [
    # "01-08-lesson-real-number-classifications-and-properties-rational-irrational.md",
    # "03-06-lesson-domain-and-range-of-functions.md",
    # "03-07-lesson-algebra-of-functions-sums-products-and-quotients.md",
    # "05-06-lesson-solving-and-graphing-quadratic-inequalities.md",
    # "10-06-lesson-factorials-and-binomial-theorem.md",
    "07-02-lesson-graphing-rational-functions-and-understanding-asymptotes.md",
]

PLOT_SYSTEM_MESSAGE = (
    "Analyze the provided markdown content to identify 0-3 key mathematical concepts that would benefit from a visual plot. "
    "If there are already figures or plots, do not add more. Return an empty list. "
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
    plots = llm.get_data_completion(messages, PlotsSchema)
    print(f"Generated {len(plots.plots)} plots")
    return plots


def fix_build_error(
    original_content: str, updated_content: str, error_output: str, corpus_id: str
) -> str:
    print(f"Fixing build error for corpus_id: {corpus_id}")
    llm = load_llm_provider()
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
